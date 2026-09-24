/**
 * Integrationstest Orchestrator: pg-boss (Postgres) + Worker-Kette produce -> stage -> ... -> REVIEW (SAFE MODE).
 * Benötigt DATABASE_URL_TEST (lokales Postgres); sonst übersprungen. Mock-Provider, echter FFmpeg-Render.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import PgBoss from "pg-boss";
import { loadEnv, logger } from "@content-os/core";
import { createDb, createPgStore, runMigrations } from "@content-os/db";
import { buildRegistry } from "@content-os/providers";
import { createContext, createTopic, ELEVATOR_TOPIC, MockLLMProvider, seedProject01 } from "@content-os/pipeline";
import { QUEUES, startWorker } from "./jobs.ts";
import type { App } from "./bootstrap.ts";

const url = process.env.DATABASE_URL_TEST ?? "postgres://contentos:contentos@localhost:5432/contentos_test";
let app: App | undefined; let boss: PgBoss | undefined; let available = true;

beforeAll(async () => {
  try {
    await runMigrations(url);
    const root = await mkdtemp(join(tmpdir(), "contentos-jobs-"));
    const env = loadEnv({ ...process.env, NODE_ENV: "test", DATABASE_URL: url, PROVIDER_MODE: "mock", STORAGE_LOCAL_ROOT: root, MUSIC_LIBRARY_DIR: join(root, "nomusic"), SFX_LIBRARY_DIR: join(root, "nosfx"), RENDER_THREADS: "2" } as NodeJS.ProcessEnv);
    const db = createDb(url, { max: 4 });
    const store = createPgStore(db.db);
    const ctx = createContext({ env, store, registry: buildRegistry(env, { mockLLM: new MockLLMProvider() }), logger });
    app = { env, ctx, store, close: db.close, saveSecret: async () => {}, loadSecret: async () => "" };
    boss = await startWorker(app);
  } catch (e) { available = false; console.warn("Jobs-Test übersprungen:", String(e).slice(0, 200)); }
});
afterAll(async () => { if (boss) await boss.stop({ graceful: false, timeout: 5000 }); if (app) await app.close(); });

describe("Orchestrator-Kette (pg-boss)", () => {
  it("produce-Job führt alle Stufen bis REVIEW aus", async (t) => {
    if (!available || !app || !boss) return t.skip();
    const project = await seedProject01(app.store, { slug: `jobs-${Date.now()}` });
    await app.store.channels.create({ projectId: project.id, platform: "youtube", name: "T", defaultPrivacy: "private", defaultPublishHourLocal: 17, timezone: "Europe/Berlin", active: true });
    const topic = await createTopic(app.ctx, { projectId: project.id, title: ELEVATOR_TOPIC.title, angle: ELEVATOR_TOPIC.angle, format: "SHORT" });
    await boss.send(QUEUES.produce, { topicId: topic.id });
    const deadline = Date.now() + 400_000;
    let video;
    while (Date.now() < deadline) {
      const [v] = await app.store.videos.list({ projectId: project.id, limit: 1 });
      video = v;
      if (v && (v.stage === "REVIEW" || ["DEAD_LETTER", "PAUSED", "REJECTED"].includes(v.status))) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    expect(video, "Video wurde nicht angelegt").toBeTruthy();
    expect(video!.status, video!.statusReason).not.toBe("DEAD_LETTER");
    expect(video!.stage).toBe("REVIEW");
    const audit = await app.store.audit.list({ entityId: video!.id, limit: 100 });
    const transitions = audit.filter((a) => a.action === "video.transition").map((a) => a.details.to);
    expect(transitions).toEqual(expect.arrayContaining(["RESEARCH", "FACT_CHECK", "SCRIPT", "STORYBOARD", "ASSETS", "VOICE", "EDIT", "QA", "REVIEW"]));
    expect((await app.store.costs.list({ videoId: video!.id })).length).toBeGreaterThan(10);
  }, 450_000);
});
