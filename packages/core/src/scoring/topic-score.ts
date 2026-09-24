import type { TopicScoreFactors, VideoFormat } from "../domain.ts";

/** Gewichte sind versioniert: Änderungen nur über neue Rules-Version (Learning Loop). */
export interface TopicScoreWeights extends TopicScoreFactors {}

export const DEFAULT_TOPIC_WEIGHTS: Record<VideoFormat, TopicScoreWeights> = {
  SHORT: {
    viralPotential: 0.2, curiosityGap: 0.2, visualPotential: 0.2, evergreenPotential: 0.05,
    searchDemand: 0.05, competition: 0.05, commercialValue: 0.05, novelty: 0.1,
    productionDifficulty: 0.05, factualRisk: 0.05,
  },
  LONGFORM: {
    viralPotential: 0.1, curiosityGap: 0.15, visualPotential: 0.15, evergreenPotential: 0.15,
    searchDemand: 0.1, competition: 0.05, commercialValue: 0.1, novelty: 0.08,
    productionDifficulty: 0.05, factualRisk: 0.07,
  },
};

export function scoreTopic(factors: TopicScoreFactors, format: VideoFormat, weights = DEFAULT_TOPIC_WEIGHTS[format]): number {
  let total = 0;
  let wsum = 0;
  for (const key of Object.keys(weights) as (keyof TopicScoreFactors)[]) {
    const v = clamp01(factors[key]);
    const w = weights[key];
    total += v * w;
    wsum += w;
  }
  return wsum > 0 ? Number((total / wsum).toFixed(4)) : 0;
}

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/** Wählt die besten N Themen; harte Ausschlüsse: hohes Faktenrisiko oder Duplikat. */
export function selectTopics<T extends { score?: number; factors?: TopicScoreFactors; originalityPassed?: boolean }>(
  topics: T[],
  n: number,
  opts: { minScore?: number; maxFactualRiskInverse?: number } = {},
): T[] {
  const minScore = opts.minScore ?? 0.55;
  const minFactual = opts.maxFactualRiskInverse ?? 0.4;
  return topics
    .filter((t) => (t.score ?? 0) >= minScore)
    .filter((t) => (t.factors?.factualRisk ?? 1) >= minFactual)
    .filter((t) => t.originalityPassed !== false)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, n);
}
