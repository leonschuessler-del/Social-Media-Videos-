import { describe, expect, it } from "vitest";
import { createMemoryStore, loadEnv } from "@content-os/core";
import { buildRegistry } from "@content-os/providers";
import { createContext } from "./context.ts";
import { MockLLMProvider } from "./mock/mock-llm.ts";
import { seedProject01 } from "./seed.ts";
import { createTopic } from "./stages/topic.ts";
import { planProduction } from "./planner.ts";
import { experimentReport } from "./experiments.ts";

function setup() {
  const env = loadEnv({ ...process.env, NODE_ENV: "test", PROVIDER_MODE: "mock", STORAGE_LOCAL_ROOT: "/tmp/contentos-planner" } as NodeJS.ProcessEnv);
  const store = createMemoryStore();
  const ctx = createContext({ env, store, registry: buildRegistry(env, { mockLLM: new MockLLMProvider() }) });
  return { ctx, store };
}

describe("planProduction", () => {
  it("bewertet Ideen und startet nur bis zum Tageslimit – Rest bleibt in der Queue", async () => {
    const { ctx, store } = setup();
    const p = await seedProject01(store, { maxVideosPerDay: 2 });
    for (const title of ["Was passiert im Motor bei 8.000 U/min?", "Was passiert in einer Mikrowelle wirklich?", "Was passiert beim Blitzschlag ins Flugzeug?", "Was passiert im Inneren eines Vulkans?"]) await createTopic(ctx, { projectId: p.id, title, format: "SHORT" });
    const r = await planProduction(ctx, p.id);
    expect(r.scored).toBe(4);
    expect(r.started.length).toBe(2);
    expect(r.remainingToday).toBe(0);
    expect(r.skipped.filter((s) => s.reason.includes("Tageslimit")).length).toBe(2);
    const again = await planProduction(ctx, p.id);
    expect(again.started.length).toBe(0);
  });
  it("Kill Switch (persistent) stoppt Planung", async () => {
    const { ctx, store } = setup();
    const p = await seedProject01(store);
    await ctx.setKillSwitch(true, "test");
    await createTopic(ctx, { projectId: p.id, title: "Was passiert bei 72 Stunden ohne Schlaf?", format: "SHORT" });
    expect((await planProduction(ctx, p.id)).started.length).toBe(0);
    expect(await ctx.refreshKillSwitch()).toBe(true);
  });
});

describe("experimentReport", () => {
  it("verweigert Aussagen bei zu kleiner Stichprobe und erkennt klare Unterschiede", async () => {
    const { store } = setup();
    const p = await seedProject01(store);
    const topic = await store.topics.create({ projectId: p.id, title: "t", angle: "", format: "SHORT", language: "de", source: "manual", status: "PRODUCED", tags: [] });
    const mk = async (visualStyle: string, apv: number) => {
      const v = await store.videos.create({ projectId: p.id, topicId: topic.id, format: "SHORT", language: "de", stage: "ANALYTICS", status: "DONE", stageAttempt: 0, costEur: 0.5, experiment: { topicId: topic.id, hookType: "QUESTION", titleVariant: "x", scriptStyle: "s", visualStyle, durationSec: 45, language: "de", generationModels: {}, generationCostEur: 0.5 } });
      await store.analytics.upsert({ videoId: v.id, channelId: "c", capturedAt: new Date().toISOString(), windowDays: 7, views: 1000, averagePercentageViewed: apv });
    };
    for (let i = 0; i < 5; i++) { await mk("xray", 70 + i); await mk("cinematic", 50 + i); }
    const small = await experimentReport(store, { projectId: p.id, dimension: "visualStyle", metric: "averagePercentageViewed" });
    expect(small.conclusive).toBe(false);
    expect(small.note).toMatch(/Zu wenig Daten/);
    for (let i = 0; i < 30; i++) { await mk("xray", 68 + (i % 5)); await mk("cinematic", 52 + (i % 5)); }
    const big = await experimentReport(store, { projectId: p.id, dimension: "visualStyle", metric: "averagePercentageViewed" });
    expect(big.conclusive).toBe(true);
    expect(big.finding).toMatch(/visualStyle=xray/);
  });
});
