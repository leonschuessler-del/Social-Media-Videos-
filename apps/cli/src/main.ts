/**
 * content-os CLI – Vertical Slice ohne Dashboard bedienen.
 *   pnpm cli produce --title "Was passiert, wenn ein Aufzugseil reißt?" --format SHORT [--memory] [--until REVIEW]
 *   pnpm cli review <videoId> --decision APPROVE
 *   pnpm cli status
 *   pnpm cli providers
 */
import "dotenv/config";
import { Command } from "commander";
import { createMemoryStore, loadEnv, logger, type Store } from "@content-os/core";
import { createDb, createPgStore, runMigrations } from "@content-os/db";
import { buildRegistry } from "@content-os/providers";
import { createContext, createTopic, createVideoForTopic, MockLLMProvider, reviewDecision, runStage, runUntil, seedProject01, ELEVATOR_TOPIC } from "@content-os/pipeline";

async function setup(memory: boolean) {
  const env = loadEnv();
  let store: Store; let close = async () => {};
  if (memory) store = createMemoryStore();
  else { await runMigrations(env.DATABASE_URL); const db = createDb(env.DATABASE_URL); store = createPgStore(db.db); close = db.close; }
  const registry = buildRegistry(env, { mockLLM: new MockLLMProvider() });
  const ctx = createContext({ env, store, registry, logger });
  const project = await seedProject01(store);
  if ((await store.channels.listByProject(project.id)).length === 0) await store.channels.create({ projectId: project.id, platform: "youtube", name: "Visual Science (YouTube)", defaultPrivacy: "private", defaultPublishHourLocal: 17, timezone: "Europe/Berlin", active: true });
  return { env, ctx, store, project, close };
}

const program = new Command().name("content-os").description("AI Content OS CLI");

program.command("produce").description("Thema anlegen und Pipeline bis Stage ausführen")
  .option("--title <title>", "Thema", ELEVATOR_TOPIC.title).option("--angle <angle>", "Blickwinkel", ELEVATOR_TOPIC.angle)
  .option("--format <format>", "SHORT|LONGFORM", "SHORT").option("--until <stage>", "bis Stage (exklusive)", "REVIEW").option("--memory", "In-Memory-Store statt Postgres", false)
  .action(async (o) => {
    const { ctx, store, project, close } = await setup(o.memory);
    const topic = await createTopic(ctx, { projectId: project.id, title: o.title, angle: o.angle, format: o.format });
    const video = await createVideoForTopic(ctx, topic.id);
    console.log(`Video ${video.id} angelegt (${o.format}). Läuft bis ${o.until} …`);
    const t0 = Date.now();
    const done = await runUntil(ctx, video.id, o.until);
    const costs = await store.costs.summarize({ videoId: video.id });
    const assets = await store.assets.listByVideo(video.id);
    const render = assets.find((a) => a.kind === "render");
    const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
    console.log(JSON.stringify({ videoId: done.id, stage: done.stage, status: done.status, reason: done.statusReason, qualityScore: done.qualityScore, title: done.metadata?.selectedTitle, renderPath: render ? await storage.localPath(render.storageKey) : null, durationSec: render?.durationSec, assets: assets.length, usage: costs, seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
    await close();
  });

program.command("run-stage <videoId>").description("Genau eine Stufe ausführen").option("--memory", "", false).action(async (videoId, o) => {
  const { ctx, close } = await setup(o.memory);
  console.log(JSON.stringify(await runStage(ctx, videoId), null, 2)); await close();
});

program.command("review <videoId>").description("Review-Entscheidung").requiredOption("--decision <d>", "APPROVE|REJECT|REGENERATE|FIX").option("--notes <n>").option("--reviewer <r>", "", "operator").option("--publish", "nach APPROVE sofort READY-Stufe ausführen (Upload/Schedule)", false)
  .action(async (videoId, o) => {
    const { ctx, close } = await setup(false);
    let v = await reviewDecision(ctx, videoId, { reviewer: o.reviewer, decision: o.decision, notes: o.notes });
    if (o.publish && v.stage === "READY") v = (await runStage(ctx, videoId)).video;
    console.log(JSON.stringify({ id: v.id, stage: v.stage, status: v.status, externalVideoId: v.externalVideoId, scheduledFor: v.scheduledFor, reason: v.statusReason }, null, 2)); await close();
  });

program.command("status").description("Pipeline-Übersicht").action(async () => {
  const { store, close } = await setup(false);
  const videos = await store.videos.list({ limit: 500 });
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  console.table(videos.map((v) => ({ id: v.id.slice(0, 14), format: v.format, stage: v.stage, status: v.status, score: v.qualityScore?.toFixed(2), costEur: v.costEur.toFixed(3), reason: (v.statusReason ?? "").slice(0, 50) })));
  console.log("Heute:", await store.costs.summarize({ since: dayStart }));
  await close();
});

program.command("providers").description("Provider-Status (AVAILABLE / MOCK / BLOCKED_BY_PROVIDER / DISABLED)").action(async () => {
  const { ctx, close } = await setup(true);
  console.table(ctx.registry.infos.map((i) => ({ name: i.name, status: i.status, capabilities: i.capabilities.join(","), notes: i.notes ?? "" })));
  await close();
});

await program.parseAsync(process.argv);
