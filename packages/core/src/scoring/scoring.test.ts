import { describe, expect, it } from "vitest";
import { scoreTopic, selectTopics } from "./topic-score.ts";
import { computeQualityScore, decideFromChecks } from "./quality-score.ts";

const f = { viralPotential: 0.8, curiosityGap: 0.9, visualPotential: 0.9, evergreenPotential: 0.8, searchDemand: 0.5, competition: 0.6, commercialValue: 0.5, novelty: 0.7, productionDifficulty: 0.6, factualRisk: 0.9 };

describe("topic scoring", () => {
  it("liefert Wert zwischen 0 und 1", () => {
    const s = scoreTopic(f, "SHORT");
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThanOrEqual(1);
  });
  it("selectTopics filtert Faktenrisiko und sortiert", () => {
    const sel = selectTopics(
      [
        { score: 0.9, factors: { ...f, factualRisk: 0.2 } },
        { score: 0.7, factors: f },
        { score: 0.8, factors: f, originalityPassed: false },
        { score: 0.75, factors: f },
      ],
      5,
    );
    expect(sel.map((t) => t.score)).toEqual([0.75, 0.7]);
  });
});

describe("quality scoring", () => {
  const parts = { factAccuracy: 0.9, visualQuality: 0.8, audioQuality: 0.8, originality: 0.9, hookStrength: 0.7, retentionPrediction: 0.7, policySafety: 1, technicalQuality: 1 };
  it("gewichtet", () => {
    expect(computeQualityScore(parts).total).toBeGreaterThan(0.8);
  });
  it("Policy-critical => REJECT", () => {
    const d = decideFromChecks([{ check: "POLICY", passed: false, severity: "critical", details: "x", automation: "AUTOMATED" }], computeQualityScore(parts), 0.6);
    expect(d.decision).toBe("REJECT");
  });
  it("error => FIX, warn => REVIEW, sonst PASS", () => {
    const q = computeQualityScore(parts);
    expect(decideFromChecks([{ check: "AUDIO", passed: false, severity: "error", details: "clip", automation: "AUTOMATED" }], q, 0.6).decision).toBe("FIX");
    expect(decideFromChecks([{ check: "VISUAL", passed: false, severity: "warn", details: "soft", automation: "AUTOMATED" }], q, 0.6).decision).toBe("REVIEW");
    expect(decideFromChecks([], q, 0.6).decision).toBe("PASS");
  });
});
