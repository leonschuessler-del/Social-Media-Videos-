import type { AnalyticsSnapshot, Video } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { recordUsage } from "../llm.ts";

/** Holt Analytics für ein veröffentlichtes Video (Fenster seit Veröffentlichung) und speichert Snapshot. */
export async function runAnalytics(ctx: PipelineContext, video: Video, now = new Date()): Promise<AnalyticsSnapshot | undefined> {
  if (!video.externalVideoId || !video.channelId) return undefined;
  const provider = ctx.registry.pick("analytics", ["youtube", "mock"], "analytics.youtube");
  const start = (video.publishedAt ?? video.scheduledFor ?? video.updatedAt).slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  const res = await provider.fetchVideoStats({ channelId: video.channelId, externalVideoId: video.externalVideoId, startDate: start, endDate: end });
  await recordUsage(ctx, res.usage, "analytics.youtube", { projectId: video.projectId, videoId: video.id, stage: "ANALYTICS" });
  const row = res.rows[0] ?? {};
  let retentionCurve: { pct: number; ratio: number }[] | undefined;
  if (provider.fetchRetention) { try { const r = await provider.fetchRetention({ channelId: video.channelId, externalVideoId: video.externalVideoId, startDate: start, endDate: end }); retentionCurve = r.curve; } catch { /* optional */ } }
  const num = (k: string) => (row[k] !== undefined && row[k] !== null ? Number(row[k]) : undefined);
  const views = num("views");
  const revenue = num("estimatedRevenue");
  const windowDays = Math.max(1, Math.round((now.getTime() - new Date(start).getTime()) / 86_400_000));
  const snap = await ctx.store.analytics.upsert({
    videoId: video.id, channelId: video.channelId, capturedAt: now.toISOString(), windowDays,
    views, watchTimeMinutes: num("estimatedMinutesWatched"), averageViewDurationSec: num("averageViewDuration"), averagePercentageViewed: num("averageViewPercentage"),
    subscribersGained: num("subscribersGained"), likes: num("likes"), shares: num("shares"), comments: num("comments"), estimatedRevenueUsd: revenue,
    rpmUsd: views && revenue !== undefined && views > 0 ? (revenue / views) * 1000 : undefined, retentionCurve, raw: row,
    // Impressions/CTR: NICHT per YouTube Analytics API verfügbar (nur Studio) -> bleibt undefined (MANUAL)
  });
  if (video.stage === "PUBLISHED") await ctx.store.videos.update(video.id, { stage: "ANALYTICS", status: "DONE" });
  return snap;
}
