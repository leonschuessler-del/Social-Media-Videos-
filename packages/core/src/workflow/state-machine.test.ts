import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, nextStage, routeAfterQa } from "./state-machine.ts";

describe("state machine", () => {
  it("erlaubt die Hauptpipeline in Reihenfolge", () => {
    expect(canTransition("RESEARCH", "FACT_CHECK")).toBe(true);
    expect(canTransition("QA", "REVIEW")).toBe(true);
    expect(canTransition("READY", "SCHEDULED")).toBe(true);
  });
  it("verbietet Sprünge", () => {
    expect(canTransition("IDEA", "PUBLISHED")).toBe(false);
    expect(() => assertTransition("SCRIPT", "PUBLISHED")).toThrow();
  });
  it("nextStage folgt der Reihenfolge", () => {
    expect(nextStage("EDIT")).toBe("QA");
    expect(nextStage("ARCHIVED")).toBeUndefined();
  });
  it("SAFE MODE schickt immer in REVIEW", () => {
    const r = routeAfterQa({ reviewMode: "SAFE", decision: "PASS", qualityScore: 0.95, autoApproveThreshold: 0.8, minPublishScore: 0.6 });
    expect(r.stage).toBe("REVIEW");
  });
  it("SEMI_AUTO gibt nur über Threshold frei", () => {
    const hi = routeAfterQa({ reviewMode: "SEMI_AUTO", decision: "PASS", qualityScore: 0.9, autoApproveThreshold: 0.8, minPublishScore: 0.6 });
    const lo = routeAfterQa({ reviewMode: "SEMI_AUTO", decision: "PASS", qualityScore: 0.7, autoApproveThreshold: 0.8, minPublishScore: 0.6 });
    expect(hi.stage).toBe("READY");
    expect(lo.stage).toBe("REVIEW");
  });
  it("unter minPublishScore nie automatisch", () => {
    const r = routeAfterQa({ reviewMode: "FULL_AUTO", decision: "PASS", qualityScore: 0.5, autoApproveThreshold: 0.8, minPublishScore: 0.6 });
    expect(r.stage).toBe("REVIEW");
  });
  it("REGENERATE springt zurück", () => {
    const r = routeAfterQa({ reviewMode: "SAFE", decision: "REGENERATE", qualityScore: 0.3, autoApproveThreshold: 0.8, minPublishScore: 0.6, regenerateTarget: "STORYBOARD" });
    expect(r.stage).toBe("STORYBOARD");
  });
});
