import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import PgBoss from "pg-boss";
import { logger, STAGES } from "@content-os/core";
import { createTopic, reviewDecision, scoreTopicWithLLM, discoverTopics, seedProject01 } from "@content-os/pipeline";
import { authUrl, exchangeCode } from "@content-os/providers";
import { bootstrap } from "./bootstrap.ts";
import { QUEUES } from "./jobs.ts";

const app = await bootstrap();
const boss = new PgBoss({ connectionString: app.env.DATABASE_URL, schema: "pgboss" });
await boss.start();
for (const q of Object.values(QUEUES)) { if (!(await boss.getQueue(q))) { logger.warn({ q }, "Queue fehlt – Worker zuerst starten (legt Queues inkl. DLQ an)"); } }

const api = new Hono();

// --- Auth: simples Bearer-Token (V1, Single-Operator). OAuth-Callback bleibt offen. ---
api.use("*", async (c, next) => {
  if (c.req.path.startsWith("/oauth/") || c.req.path === "/health" || c.req.path === "/") return next();
  const auth = c.req.header("authorization") ?? (c.req.query("token") ? `Bearer ${c.req.query("token")}` : undefined);
  if (auth !== `Bearer ${app.env.API_TOKEN}`) return c.json({ error: "unauthorized" }, 401);
  return next();
});

// Minimal-Dashboard (statisch, ohne Build-Schritt) – Review-Queue, Player, Usage, Kill Switch
api.get("/", async (c) => c.html(await readFile(join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html"), "utf8")));

api.get("/health", (c) => c.json({ ok: true, killSwitch: app.ctx.isKilled(), providerMode: app.env.PROVIDER_MODE }));

// --- Overview (Dashboard-Daten) ---
api.get("/overview", async (c) => {
  const projects = await app.store.projects.list();
  const videos = await app.store.videos.list({ limit: 5000 });
  const byStage = Object.fromEntries(STAGES.map((s) => [s, videos.filter((v) => v.stage === s).length]));
  const byStatus = videos.reduce<Record<string, number>>((a, v) => { a[v.status] = (a[v.status] ?? 0) + 1; return a; }, {});
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));
  const today = await app.store.costs.summarize({ since: dayStart });
  const month = await app.store.costs.summarize({ since: monthStart });
  const providers = app.ctx.registry.infos;
  return c.json({ projects: projects.length, videos: videos.length, byStage, byStatus, usageToday: today, usageMonth: month, budgets: { dailyEur: app.env.BUDGET_DAILY_EUR, monthlyEur: app.env.BUDGET_MONTHLY_EUR }, providers, killSwitch: app.ctx.isKilled(), reviewQueue: videos.filter((v) => v.stage === "REVIEW" && v.status === "QUEUED").length });
});

// --- Projects ---
api.get("/projects", async (c) => c.json(await app.store.projects.list()));
api.post("/projects/seed", async (c) => c.json(await seedProject01(app.store)));
api.patch("/projects/:id", zValidator("json", z.object({ reviewMode: z.enum(["SAFE", "SEMI_AUTO", "FULL_AUTO"]).optional(), maxVideosPerDay: z.number().int().min(0).max(100).optional(), active: z.boolean().optional(), autoApproveThreshold: z.number().min(0).max(1).optional(), minPublishScore: z.number().min(0).max(1).optional() })), async (c) => {
  const patch = c.req.valid("json");
  const p = await app.store.projects.update(c.req.param("id"), patch);
  await app.store.audit.log({ actor: "api", action: "project.update", entityType: "project", entityId: p.id, details: patch });
  return c.json(p);
});
api.post("/projects/:id/channels", zValidator("json", z.object({ name: z.string(), platform: z.enum(["youtube", "tiktok", "instagram"]).default("youtube"), defaultPrivacy: z.enum(["private", "unlisted", "public"]).default("private"), defaultPublishHourLocal: z.number().int().min(0).max(23).default(17), timezone: z.string().default("Europe/Berlin") })), async (c) => {
  const b = c.req.valid("json");
  return c.json(await app.store.channels.create({ projectId: c.req.param("id"), ...b, active: true }));
});

// --- Topics ---
api.get("/projects/:id/topics", async (c) => c.json(await app.store.topics.listByProject(c.req.param("id"))));
api.post("/projects/:id/topics", zValidator("json", z.object({ title: z.string().min(5), angle: z.string().optional(), format: z.enum(["SHORT", "LONGFORM"]), tags: z.array(z.string()).optional() })), async (c) => {
  const t = await createTopic(app.ctx, { projectId: c.req.param("id"), ...c.req.valid("json") });
  return c.json(t, 201);
});
api.post("/topics/:id/score", async (c) => c.json(await scoreTopicWithLLM(app.ctx, c.req.param("id"))));
api.post("/projects/:id/topics/discover", zValidator("json", z.object({ n: z.number().int().min(1).max(30).default(10) })), async (c) => c.json(await discoverTopics(app.ctx, c.req.param("id"), c.req.valid("json").n)));

// --- Produktion ---
api.post("/topics/:id/produce", zValidator("json", z.object({ channelId: z.string().optional() })), async (c) => {
  const jobId = await boss.send(QUEUES.produce, { topicId: c.req.param("id"), channelId: c.req.valid("json").channelId });
  return c.json({ jobId }, 202);
});
api.get("/videos", async (c) => c.json(await app.store.videos.list({ projectId: c.req.query("projectId"), stage: c.req.query("stage") as never, limit: Number(c.req.query("limit") ?? 200) })));
api.get("/videos/:id", async (c) => {
  const v = await app.store.videos.get(c.req.param("id"));
  if (!v) return c.json({ error: "not found" }, 404);
  const [research, script, storyboard, qa, assets, costs, audit, reviews, analytics] = await Promise.all([
    v.researchId ? app.store.research.get(v.researchId) : undefined, v.scriptId ? app.store.scripts.get(v.scriptId) : undefined, v.storyboardId ? app.store.storyboards.get(v.storyboardId) : undefined,
    v.qaReportId ? app.store.qa.get(v.qaReportId) : undefined, app.store.assets.listByVideo(v.id), app.store.costs.summarize({ videoId: v.id }), app.store.audit.list({ entityId: v.id, limit: 50 }), app.store.reviews.listByVideo(v.id), app.store.analytics.listByVideo(v.id),
  ]);
  return c.json({ video: v, research, script, storyboard, qa, assets, costs, audit, reviews, analytics });
});
api.post("/videos/:id/run", async (c) => c.json({ jobId: await boss.send(QUEUES.stage, { videoId: c.req.param("id") }, { singletonKey: `stage:${c.req.param("id")}` }) }, 202));
api.post("/videos/:id/review", zValidator("json", z.object({ reviewer: z.string().default("operator"), decision: z.enum(["APPROVE", "REJECT", "REGENERATE", "FIX"]), targetStage: z.enum(STAGES).optional(), notes: z.string().optional() })), async (c) => {
  const v = await reviewDecision(app.ctx, c.req.param("id"), c.req.valid("json"));
  if (v.stage === "READY" || v.status === "QUEUED") await boss.send(QUEUES.stage, { videoId: v.id }, { singletonKey: `stage:${v.id}` });
  return c.json(v);
});
api.post("/videos/:id/pause", async (c) => c.json(await app.store.videos.update(c.req.param("id"), { status: "PAUSED", statusReason: "manuell pausiert" })));
api.post("/videos/:id/resume", async (c) => { const v = await app.store.videos.update(c.req.param("id"), { status: "QUEUED", statusReason: undefined, resumeAfter: undefined }); await boss.send(QUEUES.stage, { videoId: v.id }, { singletonKey: `stage:${v.id}` }); return c.json(v); });
api.get("/videos/:id/asset/:assetId", async (c) => {
  const a = await app.store.assets.get(c.req.param("assetId"));
  if (!a || a.videoId !== c.req.param("id")) return c.json({ error: "not found" }, 404);
  const storage = app.ctx.registry.pick("storage", ["s3", "local"], "storage");
  const buf = await storage.get(a.storageKey);
  return new Response(new Uint8Array(buf), { headers: { "content-type": a.mimeType, "content-length": String(buf.length) } });
});

// --- Usage / Kosten ---
api.get("/usage", async (c) => {
  const since = c.req.query("since") ? new Date(c.req.query("since")!) : undefined;
  return c.json({ summary: await app.store.costs.summarize({ projectId: c.req.query("projectId"), since }), entries: (await app.store.costs.list({ projectId: c.req.query("projectId"), since })).slice(-500) });
});
api.get("/audit", async (c) => c.json(await app.store.audit.list({ entityId: c.req.query("entityId"), limit: 200 })));

// --- Kill Switch (Laufzeit) ---
api.post("/kill-switch", zValidator("json", z.object({ enabled: z.boolean() })), async (c) => {
  process.env.KILL_SWITCH = c.req.valid("json").enabled ? "true" : "false";
  await app.store.audit.log({ actor: "api", action: "kill_switch", entityType: "system", entityId: "kill_switch", details: { enabled: c.req.valid("json").enabled } });
  return c.json({ killSwitch: app.ctx.isKilled(), note: "Wirkt prozessweit für API; Worker liest KILL_SWITCH aus Env – für harten Stopp Worker-Env setzen und neu starten." });
});

// --- YouTube OAuth (offizieller Flow) ---
api.get("/oauth/youtube/start", async (c) => {
  if (!app.env.YOUTUBE_CLIENT_ID || !app.env.YOUTUBE_CLIENT_SECRET) return c.json({ error: "YOUTUBE_CLIENT_ID/SECRET fehlen" }, 400);
  const channelId = c.req.query("channelId");
  if (!channelId) return c.json({ error: "channelId erforderlich" }, 400);
  const url = authUrl({ clientId: app.env.YOUTUBE_CLIENT_ID, clientSecret: app.env.YOUTUBE_CLIENT_SECRET, redirectUri: `${app.env.YOUTUBE_REDIRECT_URI}?channelId=${channelId}` });
  return c.redirect(url);
});
api.get("/oauth/youtube/callback", async (c) => {
  const code = c.req.query("code"); const channelId = c.req.query("channelId");
  if (!code || !channelId) return c.json({ error: "code/channelId fehlen" }, 400);
  const { refreshToken } = await exchangeCode({ clientId: app.env.YOUTUBE_CLIENT_ID!, clientSecret: app.env.YOUTUBE_CLIENT_SECRET!, redirectUri: `${app.env.YOUTUBE_REDIRECT_URI}?channelId=${channelId}` }, code);
  const ref = `youtube:${channelId}`;
  await app.saveSecret(ref, refreshToken);
  await app.store.channels.update(channelId, { credentialsRef: ref });
  await app.store.audit.log({ actor: "api", action: "channel.oauth", entityType: "channel", entityId: channelId, details: { ref } });
  return c.text("YouTube-Kanal verbunden. Fenster kann geschlossen werden.");
});

serve({ fetch: api.fetch, port: app.env.API_PORT }, (info) => logger.info({ port: info.port }, "API gestartet"));
