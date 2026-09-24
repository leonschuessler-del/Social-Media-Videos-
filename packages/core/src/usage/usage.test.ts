import { describe, expect, it } from "vitest";
import { MemoryUsageSink, UsageManager } from "./usage-manager.ts";
import { estimateUsd } from "./pricing.ts";

describe("UsageManager", () => {
  it("rechnet Kosten und zählt", async () => {
    const sink = new MemoryUsageSink();
    const um = new UsageManager(sink, 0.92);
    await um.record({ provider: "openai", model: "gpt-6-sol", capability: "llm.cheap", units: 1_000_000, unitType: "output_tokens" });
    await um.record({ provider: "openai", model: "gpt-image-2:medium", capability: "image.generate", units: 3, unitType: "images" });
    await um.record({ provider: "mock", model: "mock", capability: "video.generate", units: 8, unitType: "video_seconds", failed: true, retry: true });
    const s = sink.summarize();
    expect(s.textJobs).toBe(1);
    expect(s.images).toBe(3);
    expect(s.videoClips).toBe(1);
    expect(s.failures).toBe(1);
    expect(s.retries).toBe(1);
    expect(s.costUsd).toBeCloseTo(10 + 3 * 0.053, 3);
    expect(s.costEur).toBeCloseTo((10 + 3 * 0.053) * 0.92, 3);
  });
  it("unbekannte Preise => known=false", () => {
    expect(estimateUsd("foo", "bar", "images", 1).known).toBe(false);
  });
});
