import type { Video } from "@content-os/core";
import { ContentOsError } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { recordUsage } from "../llm.ts";

/** Nächster Veröffentlichungs-Slot nach Kanal-Default (lokale Stunde, Zeitzone). */
export function nextPublishSlot(hourLocal: number, timezone: string, from = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(from).map((p) => [p.type, p.value]));
  const localHour = Number(parts.hour) % 24;
  const target = new Date(from);
  const offsetMs = (() => { const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), localHour, Number(parts.minute)); return asUtc - from.getTime(); })();
  target.setTime(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hourLocal, 0) - offsetMs);
  if (target.getTime() <= from.getTime() + 15 * 60_000) target.setTime(target.getTime() + 24 * 3600_000);
  return target;
}

/**
 * Publish: nur für Videos in Stage READY (Freigabe erfolgt). Nutzt offizielle YouTube Data API (oder Mock).
 * Setzt containsSyntheticMedia=true (realistisch wirkende KI-Visuals), selfDeclaredMadeForKids=false.
 */
export async function runPublish(ctx: PipelineContext, video: Video, opts: { schedule?: boolean; privacy?: "private" | "unlisted" | "public" } = {}): Promise<Video> {
  if (video.stage !== "READY" && video.stage !== "SCHEDULED") throw new ContentOsError("INVALID_TRANSITION", `Publish nur aus READY/SCHEDULED, aktuell ${video.stage}`);
  if (ctx.isKilled()) throw new ContentOsError("KILL_SWITCH", "Kill Switch aktiv – kein Upload");
  const [project, channels] = await Promise.all([ctx.store.projects.get(video.projectId), ctx.store.channels.listByProject(video.projectId)]);
  const channel = channels.find((c) => c.id === video.channelId) ?? channels.find((c) => c.platform === "youtube" && c.active);
  if (!project || !channel) throw new ContentOsError("VALIDATION", "Kein aktiver YouTube-Kanal im Projekt");
  if (!video.metadata || !video.renderAssetId) throw new ContentOsError("VALIDATION", "Metadata/Render fehlen");
  const storage = ctx.registry.pick("storage", ["s3", "local"], "storage");
  const render = await ctx.store.assets.get(video.renderAssetId);
  const thumb = video.thumbnailAssetId ? await ctx.store.assets.get(video.thumbnailAssetId) : undefined;
  if (!render) throw new ContentOsError("NOT_FOUND", "Render-Asset fehlt");
  const publisher = ctx.registry.pick("publish", ["youtube", "mock"], "publish.youtube");
  const publishAt = opts.schedule === false ? undefined : nextPublishSlot(channel.defaultPublishHourLocal, channel.timezone).toISOString();
  const res = await publisher.upload({
    channelId: channel.id, filePath: await storage.localPath(render.storageKey), title: video.metadata.selectedTitle, description: video.metadata.description, tags: video.metadata.tags,
    privacy: opts.privacy ?? channel.defaultPrivacy, publishAt, categoryId: video.metadata.categoryId, defaultLanguage: video.language, madeForKids: false, containsSyntheticMedia: true,
    thumbnailPath: thumb && video.format === "LONGFORM" ? await storage.localPath(thumb.storageKey) : undefined, notifySubscribers: true,
  });
  await recordUsage(ctx, res.usage, "publish.youtube", { projectId: project.id, videoId: video.id, stage: "SCHEDULED" });
  await ctx.store.audit.log({ actor: "system", action: "video.publish", entityType: "video", entityId: video.id, details: { externalVideoId: res.externalVideoId, status: res.status, warnings: res.warnings, mock: publisher.name === "mock" } });
  const updated = await ctx.store.videos.update(video.id, { stage: publishAt ? "SCHEDULED" : "PUBLISHED", status: "DONE", externalVideoId: res.externalVideoId, channelId: channel.id, scheduledFor: publishAt, publishedAt: publishAt ? undefined : new Date().toISOString(), statusReason: res.warnings.join("; ") || undefined, experiment: video.experiment ? { ...video.experiment, channelId: channel.id, publishedAt: publishAt ?? new Date().toISOString() } : undefined });
  return updated;
}
