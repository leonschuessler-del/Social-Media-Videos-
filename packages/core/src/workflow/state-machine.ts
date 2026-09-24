import { STAGES, type RunStatus, type Stage, type ReviewMode } from "../domain.ts";
import { ContentOsError } from "../errors.ts";

/** Produktions-Stufen, die ein Job-Worker ausführt (in Reihenfolge). */
export const PRODUCTION_STAGES: Stage[] = [
  "RESEARCH", "FACT_CHECK", "SCRIPT", "STORYBOARD", "ASSETS", "VOICE", "EDIT", "QA",
];

/** Erlaubte Vorwärts-/Rückwärts-Übergänge (from -> to[]). */
const TRANSITIONS: Record<Stage, Stage[]> = {
  IDEA: ["SCORED", "ARCHIVED"],
  SCORED: ["SELECTED", "ARCHIVED"],
  SELECTED: ["RESEARCH", "ARCHIVED"],
  RESEARCH: ["FACT_CHECK", "ARCHIVED"],
  FACT_CHECK: ["SCRIPT", "RESEARCH", "ARCHIVED"],
  SCRIPT: ["STORYBOARD", "RESEARCH", "ARCHIVED"],
  STORYBOARD: ["ASSETS", "SCRIPT", "ARCHIVED"],
  ASSETS: ["VOICE", "STORYBOARD", "ARCHIVED"],
  VOICE: ["EDIT", "SCRIPT", "ARCHIVED"],
  EDIT: ["QA", "ASSETS", "VOICE", "ARCHIVED"],
  QA: ["REVIEW", "READY", "ASSETS", "SCRIPT", "STORYBOARD", "EDIT", "ARCHIVED"],
  REVIEW: ["READY", "SCRIPT", "STORYBOARD", "ASSETS", "EDIT", "ARCHIVED"],
  READY: ["SCHEDULED", "REVIEW", "ARCHIVED"],
  SCHEDULED: ["PUBLISHED", "READY", "ARCHIVED"],
  PUBLISHED: ["ANALYTICS", "ARCHIVED"],
  ANALYTICS: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: Stage, to: Stage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: Stage, to: Stage): void {
  if (!canTransition(from, to)) {
    throw new ContentOsError("INVALID_TRANSITION", `Ungültiger Übergang ${from} -> ${to}`, { details: { from, to } });
  }
}

export function nextStage(stage: Stage): Stage | undefined {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i + 1 < STAGES.length ? STAGES[i + 1] : undefined;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

export function isProductionStage(stage: Stage): boolean {
  return PRODUCTION_STAGES.includes(stage);
}

/**
 * Entscheidet nach QA, wohin das Video geht – abhängig vom Review-Modus des Projekts.
 * V1 startet in SAFE: jedes Video geht in REVIEW.
 */
export function routeAfterQa(input: {
  reviewMode: ReviewMode;
  decision: "PASS" | "FIX" | "REGENERATE" | "REVIEW" | "REJECT";
  qualityScore: number;
  autoApproveThreshold: number;
  minPublishScore: number;
  regenerateTarget?: Stage;
}): { stage: Stage; status: RunStatus; reason: string } {
  const { reviewMode, decision, qualityScore, autoApproveThreshold, minPublishScore } = input;

  if (decision === "REJECT") return { stage: "REVIEW", status: "REJECTED", reason: "QA: REJECT" };
  if (decision === "REGENERATE" || decision === "FIX") {
    const target = input.regenerateTarget ?? "ASSETS";
    return { stage: target, status: "QUEUED", reason: `QA: ${decision} -> ${target}` };
  }
  if (qualityScore < minPublishScore) {
    return { stage: "REVIEW", status: "QUEUED", reason: `Score ${qualityScore.toFixed(2)} < minPublishScore ${minPublishScore}` };
  }
  if (reviewMode === "SAFE") return { stage: "REVIEW", status: "QUEUED", reason: "SAFE MODE: menschliche Freigabe erforderlich" };
  if (decision === "REVIEW") return { stage: "REVIEW", status: "QUEUED", reason: "QA: REVIEW empfohlen" };
  if (reviewMode === "SEMI_AUTO") {
    return qualityScore >= autoApproveThreshold
      ? { stage: "READY", status: "QUEUED", reason: `SEMI_AUTO: Score ${qualityScore.toFixed(2)} >= ${autoApproveThreshold}` }
      : { stage: "REVIEW", status: "QUEUED", reason: `SEMI_AUTO: Score ${qualityScore.toFixed(2)} < ${autoApproveThreshold}` };
  }
  // FULL_AUTO
  return { stage: "READY", status: "QUEUED", reason: "FULL_AUTO: automatisch freigegeben" };
}

/** Maximale Wiederholungen pro Stufe bevor DEAD_LETTER. */
export const MAX_STAGE_ATTEMPTS: Record<Stage, number> = {
  IDEA: 1, SCORED: 1, SELECTED: 1,
  RESEARCH: 3, FACT_CHECK: 3, SCRIPT: 3, STORYBOARD: 3, ASSETS: 4, VOICE: 3, EDIT: 3, QA: 2,
  REVIEW: 1, READY: 1, SCHEDULED: 5, PUBLISHED: 1, ANALYTICS: 10, ARCHIVED: 1,
};
