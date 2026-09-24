import type { AnalyticsSnapshot, Store, Video } from "@content-os/core";

export type ExperimentDimension = "hookType" | "visualStyle" | "thumbnailVariant" | "titleVariant" | "voiceId" | "format" | "language" | "publishHour" | "durationBucket";
export type ExperimentMetric = "views" | "averagePercentageViewed" | "averageViewDurationSec" | "subscribersPer1k" | "rpmUsd" | "profitEur";

export interface GroupStat { group: string; n: number; mean: number | null; ci95: [number, number] | null }
export interface ExperimentReport {
  dimension: ExperimentDimension;
  metric: ExperimentMetric;
  groups: GroupStat[];
  minSamplePerGroup: number;
  /** true nur, wenn ≥ 2 Gruppen die Mindeststichprobe erfüllen UND sich die 95%-Intervalle nicht überlappen */
  conclusive: boolean;
  finding?: string;
  note: string;
}

function dimValue(v: Video, d: ExperimentDimension): string {
  const e = v.experiment;
  switch (d) {
    case "format": return v.format;
    case "language": return v.language;
    case "publishHour": return v.experiment?.publishedAt ? String(new Date(v.experiment.publishedAt).getUTCHours()) : "unknown";
    case "durationBucket": { const s = e?.durationSec ?? 0; return s <= 60 ? "≤60s" : s <= 480 ? "1–8min" : s <= 720 ? "8–12min" : ">12min"; }
    default: return String((e as Record<string, unknown> | undefined)?.[d] ?? "unknown");
  }
}

function metricValue(v: Video, s: AnalyticsSnapshot | undefined, m: ExperimentMetric, usdEur: number): number | null {
  if (!s) return null;
  switch (m) {
    case "views": return s.views ?? null;
    case "averagePercentageViewed": return s.averagePercentageViewed ?? null;
    case "averageViewDurationSec": return s.averageViewDurationSec ?? null;
    case "subscribersPer1k": return s.views && s.subscribersGained !== undefined ? (s.subscribersGained / s.views) * 1000 : null;
    case "rpmUsd": return s.rpmUsd ?? null;
    case "profitEur": return s.estimatedRevenueUsd !== undefined ? s.estimatedRevenueUsd * usdEur - v.costEur : null;
  }
}

/**
 * Experiment-Auswertung: gruppiert veröffentlichte Videos nach einem Attribut und vergleicht eine Kennzahl
 * (jeweils letzter Analytics-Snapshot). Aussagen nur bei ausreichender Stichprobe (Default n ≥ 30 je Gruppe)
 * und nicht überlappenden 95%-Konfidenzintervallen. Keine automatische Regeländerung – nur Bericht.
 */
export async function experimentReport(store: Store, input: { projectId: string; dimension: ExperimentDimension; metric: ExperimentMetric; minSamplePerGroup?: number; usdEur?: number }): Promise<ExperimentReport> {
  const minN = input.minSamplePerGroup ?? 30;
  const videos = (await store.videos.list({ projectId: input.projectId, stage: ["PUBLISHED", "ANALYTICS"], limit: 10_000 }));
  const buckets = new Map<string, number[]>();
  for (const v of videos) {
    const snaps = await store.analytics.listByVideo(v.id);
    const latest = snaps.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).at(-1);
    const val = metricValue(v, latest, input.metric, input.usdEur ?? 0.92);
    if (val === null || Number.isNaN(val)) continue;
    const g = dimValue(v, input.dimension);
    buckets.set(g, [...(buckets.get(g) ?? []), val]);
  }
  const groups: GroupStat[] = [...buckets.entries()].map(([group, xs]) => {
    const n = xs.length;
    if (n === 0) return { group, n, mean: null, ci95: null };
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    const half = n > 1 ? 1.96 * (sd / Math.sqrt(n)) : Infinity;
    return { group, n, mean, ci95: [mean - half, mean + half] as [number, number] };
  }).sort((a, b) => (b.mean ?? -Infinity) - (a.mean ?? -Infinity));
  const eligible = groups.filter((g) => g.n >= minN && g.mean !== null);
  let conclusive = false; let finding: string | undefined;
  if (eligible.length >= 2) {
    const [best, second] = eligible as [GroupStat, GroupStat];
    conclusive = best.ci95![0] > second.ci95![1];
    if (conclusive && second.mean) finding = `${input.dimension}=${best.group} liegt bei ${input.metric} ${(((best.mean! - second.mean) / Math.abs(second.mean)) * 100).toFixed(0)} % über ${second.group} (n=${best.n}/${second.n}, 95%-KI getrennt).`;
  }
  const note = eligible.length < 2 ? `Zu wenig Daten: benötigt ≥ ${minN} Videos in mindestens 2 Gruppen.` : conclusive ? "Signifikanter Unterschied (95%-KI überlappen nicht). Regeländerung nur als neue, reversible rule_version." : "Kein belastbarer Unterschied.";
  return { dimension: input.dimension, metric: input.metric, groups, minSamplePerGroup: minN, conclusive, finding, note };
}
