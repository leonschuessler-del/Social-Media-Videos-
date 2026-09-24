import { describe, expect, it } from "vitest";
import { BudgetGuard, MemorySpendSource } from "./budget-guard.ts";
import { CapacityManager, MemoryCapacityStore } from "./capacity.ts";

describe("BudgetGuard", () => {
  const limits = { perVideoEur: { SHORT: 3, LONGFORM: 25 }, dailyEur: 20, monthlyEur: 400 };
  it("erlaubt unter Limit", async () => {
    const src = new MemorySpendSource();
    const g = new BudgetGuard(limits, src);
    await expect(g.assertCanSpend({ estimatedCostEur: 1, videoId: "v1", format: "SHORT", provider: "openai" })).resolves.toBeTruthy();
  });
  it("blockt pro Video", async () => {
    const src = new MemorySpendSource();
    src.add({ videoId: "v1", provider: "openai", costEur: 2.5 });
    const g = new BudgetGuard(limits, src);
    await expect(g.assertCanSpend({ estimatedCostEur: 1, videoId: "v1", format: "SHORT", provider: "openai" })).rejects.toThrow(/video:v1/);
  });
  it("blockt täglich", async () => {
    const src = new MemorySpendSource();
    src.add({ videoId: "a", provider: "openai", costEur: 19.5 });
    const g = new BudgetGuard(limits, src);
    await expect(g.assertCanSpend({ estimatedCostEur: 1, provider: "openai" })).rejects.toThrow(/daily/);
  });
});

describe("CapacityManager", () => {
  it("token bucket + reportLimit", async () => {
    const cm = new CapacityManager(new MemoryCapacityStore(), { "openai:video.generate": { maxPerWindow: 2, windowSeconds: 60 } });
    const t = 1_000_000;
    expect((await cm.check("openai:video.generate", 1, t)).allowed).toBe(true);
    await cm.consume("openai:video.generate", 2, t);
    const d = await cm.check("openai:video.generate", 1, t + 1000);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
    expect((await cm.check("openai:video.generate", 1, t + 61_000)).allowed).toBe(true);
    await cm.reportLimit("openai:video.generate", 120, t + 61_000);
    expect((await cm.check("openai:video.generate", 1, t + 62_000)).allowed).toBe(false);
  });
});
