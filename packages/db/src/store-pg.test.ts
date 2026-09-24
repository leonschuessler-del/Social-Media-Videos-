/** Integrationstest gegen lokales Postgres (DATABASE_URL_TEST). Übersprungen, wenn keine DB erreichbar. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.ts";
import { runMigrations } from "./migrate.ts";
import { createPgStore } from "./store-pg.ts";
import type { Store } from "@content-os/core";

const url = process.env.DATABASE_URL_TEST ?? "postgres://contentos:contentos@localhost:5432/contentos_test";
let store: Store; let close: () => Promise<void>; let available = true;

beforeAll(async () => {
  try { await runMigrations(url); const db = createDb(url, { max: 2 }); store = createPgStore(db.db); close = db.close; } catch { available = false; }
});
afterAll(async () => { if (available) await close(); });

describe("PgStore", () => {
  it("CRUD über Projekt → Topic → Video → Kosten → Snapshot", async (t) => {
    if (!available) return t.skip();
    const slug = `t-${Date.now()}`;
    const p = await store.projects.create({ slug, name: "T", niche: "n", language: "de", reviewMode: "SAFE", maxVideosPerDay: 2, autoApproveThreshold: 0.8, minPublishScore: 0.6, styleGuide: { visualStyle: "x", narrationTone: "y", hookStyle: "z", fontFamily: "DejaVu Sans", brandColors: { primary: "#000", accent: "#111", background: "#222", text: "#fff" }, captionStyle: "word", disclosureText: "d" }, rulesVersion: 1, active: true });
    expect((await store.projects.getBySlug(slug))?.id).toBe(p.id);
    const topic = await store.topics.create({ projectId: p.id, title: "Thema", angle: "", format: "SHORT", language: "de", source: "manual", status: "NEW", tags: [] });
    const v = await store.videos.create({ projectId: p.id, topicId: topic.id, format: "SHORT", language: "de", stage: "SELECTED", status: "QUEUED", stageAttempt: 0, costEur: 0 });
    await store.videos.update(v.id, { stage: "RESEARCH", statusReason: "x" });
    expect((await store.videos.list({ projectId: p.id, stage: "RESEARCH" })).length).toBe(1);
    expect(await store.videos.countStartedToday(p.id, new Date())).toBe(1);
    await store.costs.record({ id: `c_${Date.now()}`, projectId: p.id, videoId: v.id, provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", units: 10, unitType: "output_tokens", costUsd: 0.5, costEur: 0.46, coveredByQuota: false, createdAt: new Date().toISOString(), failed: false, retry: false });
    const snap = await store.costs.snapshot({ videoId: v.id, projectId: p.id, provider: "openai", now: new Date() });
    expect(snap.videoEur).toBeCloseTo(0.46, 5);
    expect((await store.costs.summarize({ videoId: v.id })).textJobs).toBe(1);
    const a = await store.assets.create({ projectId: p.id, kind: "image", storageKey: "k", mimeType: "image/png", provider: "mock", promptHash: "h1", videoId: v.id, rights: { source: "generated", attributionRequired: false }, usedInVideoIds: [v.id], tags: ["xray"] });
    expect((await store.assets.findReusable({ projectId: p.id, kind: "image", promptHash: "h1", tags: ["xray"] }))[0]?.id).toBe(a.id);
    expect((await store.assets.findReusable({ projectId: p.id, kind: "image", promptHash: "h1", excludeVideoId: v.id })).length).toBe(0);
    await store.audit.log({ actor: "test", action: "x", entityType: "video", entityId: v.id, details: {} });
    expect((await store.audit.list({ entityId: v.id })).length).toBe(1);
    const s = await store.analytics.upsert({ videoId: v.id, channelId: "c", capturedAt: new Date().toISOString(), windowDays: 1, views: 5 });
    expect(s.views).toBe(5);
  });
});
