import type { QACheckResult, QualityScore } from "../domain.ts";
import { clamp01 } from "./topic-score.ts";

export const QUALITY_WEIGHTS: Omit<QualityScore, "total"> = {
  factAccuracy: 0.22,
  visualQuality: 0.15,
  audioQuality: 0.1,
  originality: 0.13,
  hookStrength: 0.12,
  retentionPrediction: 0.1,
  policySafety: 0.1,
  technicalQuality: 0.08,
};

export function computeQualityScore(parts: Omit<QualityScore, "total">): QualityScore {
  let total = 0;
  for (const k of Object.keys(QUALITY_WEIGHTS) as (keyof typeof QUALITY_WEIGHTS)[]) {
    total += clamp01(parts[k]) * QUALITY_WEIGHTS[k];
  }
  return { ...parts, total: Number(total.toFixed(4)) };
}

/**
 * Entscheidungslogik nach QA-Checks.
 * critical => REJECT oder REGENERATE (je nach Check), error => FIX/REGENERATE, sonst PASS/REVIEW.
 */
export function decideFromChecks(checks: QACheckResult[], score: QualityScore, minPublishScore: number): {
  decision: "PASS" | "FIX" | "REGENERATE" | "REVIEW" | "REJECT";
  reasons: string[];
} {
  const reasons: string[] = [];
  const critical = checks.filter((c) => !c.passed && c.severity === "critical");
  const errors = checks.filter((c) => !c.passed && c.severity === "error");
  const warns = checks.filter((c) => !c.passed && c.severity === "warn");

  for (const c of critical) reasons.push(`CRITICAL ${c.check}: ${c.details}`);
  for (const c of errors) reasons.push(`ERROR ${c.check}: ${c.details}`);
  for (const c of warns) reasons.push(`WARN ${c.check}: ${c.details}`);

  if (critical.some((c) => c.check === "POLICY" || c.check === "RIGHTS")) return { decision: "REJECT", reasons };
  if (critical.length > 0) return { decision: "REGENERATE", reasons };
  if (errors.length > 0) return { decision: "FIX", reasons };
  if (score.total < minPublishScore) {
    reasons.push(`Score ${score.total} < ${minPublishScore}`);
    return { decision: "REVIEW", reasons };
  }
  if (warns.length > 0) return { decision: "REVIEW", reasons };
  return { decision: "PASS", reasons };
}
