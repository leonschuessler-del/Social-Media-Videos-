import PgBoss from "pg-boss";
import type { Stage } from "@content-os/core";
import { logger, PRODUCTION_STAGES } from "@content-os/core";
import { runStage, runAnalytics, createVideoForTopic } from "@content-os/pipeline";
import type { App } from "./bootstrap.ts";

export const QUEUES = {
  stage: "video.stage",          // führt die aktuelle Stufe eines Videos aus
  produce: "video.produce",      // legt Video für Topic an + startet Kette
  analytics: "analytics.pull",   // holt Analytics für veröffentlichte Videos
  resume: "capacity.resume",     // weckt WAITING_FOR_CAPACITY / FAILED-Retries
} as const;

export interface StageJob { videoId: string }
export interface ProduceJob { topicId: string; channelId?: string }

/**
 * Orchestrator auf pg-boss (PostgreSQL-only, keine Redis-Abhängigkeit):
 *  - Retry mit Backoff, Dead-Letter-Queue je Queue, Singleton-Key je Video (keine Doppelläufe)
 *  - Kill Switch: Worker nimmt keine Jobs an
 *  - Limit-aware: CapacityExhausted -> Video WAITING_FOR_CAPACITY, Resume-Cron plant später neu
 */
export async function startWorker(app: App): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: app.env.DATABASE_URL, schema: "pgboss", archiveCompletedAfterSeconds: 3600 * 24 * 7, deleteAfterDays: 30 });
  boss.on("error", (e) => logger.error({ err: e }, "pg-boss"));
  await boss.start();
  // Reihenfolge wichtig: Dead-Letter-Queues zuerst, dann Haupt-Queues (pg-boss validiert deadLetter-Referenz)
  const ensureQueue = async (name: string, opts: Partial<PgBoss.Queue> = {}) => {
    if (await boss.getQueue(name)) return;
    await boss.createQueue(name, { name, ...opts });
  };
  for (const q of Object.values(QUEUES)) await ensureQueue(`${q}.dlq`);
  for (const q of Object.values(QUEUES)) await ensureQueue(q, { retryLimit: 3, retryDelay: 60, retryBackoff: true, deadLetter: `${q}.dlq` });

  const guard = () => { if (app.ctx.isKilled()) { logger.warn("KILL_SWITCH aktiv – Job übersprungen"); return false; } return true; };

  await boss.work<StageJob>(QUEUES.stage, { batchSize: 1, pollingIntervalSeconds: 2 }, async ([job]) => {
    if (!job || !guard()) return;
    const out = await runStage(app.ctx, job.data.videoId);
    logger.info({ videoId: job.data.videoId, from: out.from, to: out.to, status: out.status, note: out.note }, "stage");
    // Kette fortsetzen, solange automatisch ausführbar
    const auto: Stage[] = [...PRODUCTION_STAGES, "READY", "PUBLISHED"];
    if (out.status === "QUEUED" && auto.includes(out.to) && out.to !== out.from) {
      await boss.send(QUEUES.stage, { videoId: job.data.videoId }, { singletonKey: `stage:${job.data.videoId}`, singletonSeconds: 5 });
    } else if (out.status === "FAILED") {
      await boss.send(QUEUES.stage, { videoId: job.data.videoId }, { singletonKey: `stage:${job.data.videoId}`, startAfter: 30 });
    } else if (out.status === "WAITING_FOR_CAPACITY" && out.video.resumeAfter) {
      const delay = Math.max(30, Math.ceil((new Date(out.video.resumeAfter).getTime() - Date.now()) / 1000));
      await boss.send(QUEUES.stage, { videoId: job.data.videoId }, { singletonKey: `stage:${job.data.videoId}`, startAfter: delay });
    }
  });

  await boss.work<ProduceJob>(QUEUES.produce, { batchSize: 1 }, async ([job]) => {
    if (!job || !guard()) return;
    const v = await createVideoForTopic(app.ctx, job.data.topicId, { channelId: job.data.channelId });
    await boss.send(QUEUES.stage, { videoId: v.id }, { singletonKey: `stage:${v.id}` });
  });

  await boss.work(QUEUES.analytics, { batchSize: 1 }, async () => {
    if (!guard()) return;
    const vids = await app.store.videos.list({ stage: ["PUBLISHED", "ANALYTICS"], limit: 200 });
    for (const v of vids) { try { await runAnalytics(app.ctx, v); } catch (e) { logger.warn({ videoId: v.id, err: String(e) }, "analytics"); } }
  });

  await boss.work(QUEUES.resume, { batchSize: 1 }, async () => {
    if (!guard()) return;
    const waiting = await app.store.videos.list({ status: ["WAITING_FOR_CAPACITY", "FAILED"], limit: 200 });
    for (const v of waiting) {
      if (v.resumeAfter && new Date(v.resumeAfter) > new Date()) continue;
      await boss.send(QUEUES.stage, { videoId: v.id }, { singletonKey: `stage:${v.id}`, singletonSeconds: 60 });
    }
  });

  await boss.schedule(QUEUES.analytics, "0 */6 * * *", {}, { tz: "UTC" });
  await boss.schedule(QUEUES.resume, "*/10 * * * *", {}, { tz: "UTC" });
  logger.info("Worker gestartet (pg-boss)");
  return boss;
}

export async function enqueueStage(boss: PgBoss, videoId: string): Promise<string | null> {
  return boss.send(QUEUES.stage, { videoId }, { singletonKey: `stage:${videoId}` });
}
