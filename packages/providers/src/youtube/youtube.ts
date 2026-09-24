import { google, type youtube_v3 } from "googleapis";
import { createReadStream } from "node:fs";
import type { AnalyticsProvider, AnalyticsQuery, PublishProvider, PublishRequest, PublishResult } from "@content-os/core";
import { ContentOsError } from "@content-os/core";

export interface YouTubeAuth { clientId: string; clientSecret: string; redirectUri: string; refreshToken: string }

export function oauthClient(auth: YouTubeAuth) {
  const c = new google.auth.OAuth2(auth.clientId, auth.clientSecret, auth.redirectUri);
  c.setCredentials({ refresh_token: auth.refreshToken });
  return c;
}

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
];

export function authUrl(auth: Omit<YouTubeAuth, "refreshToken">): string {
  const c = new google.auth.OAuth2(auth.clientId, auth.clientSecret, auth.redirectUri);
  return c.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: YOUTUBE_SCOPES });
}

export async function exchangeCode(auth: Omit<YouTubeAuth, "refreshToken">, code: string): Promise<{ refreshToken: string }> {
  const c = new google.auth.OAuth2(auth.clientId, auth.clientSecret, auth.redirectUri);
  const { tokens } = await c.getToken(code);
  if (!tokens.refresh_token) throw new ContentOsError("PROVIDER_ERROR", "Kein refresh_token erhalten (prompt=consent nötig)");
  return { refreshToken: tokens.refresh_token };
}

/**
 * YouTube Data API v3 – offizieller Upload (videos.insert, 1600 Quota-Einheiten je Upload).
 * WICHTIG: Uploads aus nicht auditierten API-Projekten werden von YouTube auf "privat" gesperrt,
 * bis das Projekt den API-Compliance-Audit bestanden hat (siehe docs/09-youtube-policy.md).
 */
export class YouTubePublishProvider implements PublishProvider {
  readonly name = "youtube";
  readonly platform = "youtube" as const;
  constructor(private readonly resolveAuth: (channelId: string) => Promise<YouTubeAuth>) {}

  private async api(channelId: string): Promise<youtube_v3.Youtube> {
    return google.youtube({ version: "v3", auth: oauthClient(await this.resolveAuth(channelId)) });
  }

  async upload(req: PublishRequest): Promise<PublishResult> {
    const yt = await this.api(req.channelId);
    const warnings: string[] = [];
    const status: youtube_v3.Schema$VideoStatus = {
      privacyStatus: req.publishAt ? "private" : req.privacy,
      publishAt: req.publishAt,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: req.containsSyntheticMedia,
    };
    let res;
    try {
      res = await yt.videos.insert({
        part: ["snippet", "status"],
        notifySubscribers: req.notifySubscribers ?? true,
        requestBody: {
          snippet: { title: req.title.slice(0, 100), description: req.description.slice(0, 5000), tags: req.tags.slice(0, 40), categoryId: req.categoryId ?? "28", defaultLanguage: req.defaultLanguage, defaultAudioLanguage: req.defaultLanguage },
          status,
        },
        media: { body: createReadStream(req.filePath) },
      });
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 403 && /quota/i.test(e.message ?? "")) throw new ContentOsError("CAPACITY_EXHAUSTED", `YouTube Quota erschöpft: ${e.message}`, { retryable: true });
      throw new ContentOsError("PROVIDER_ERROR", `YouTube Upload fehlgeschlagen: ${e.message ?? String(err)}`, { retryable: (e.code ?? 500) >= 500, cause: err });
    }
    const id = res.data.id!;
    if (req.thumbnailPath) {
      try { await this.setThumbnail(id, req.thumbnailPath, req.channelId); } catch (e) { warnings.push(`Thumbnail nicht gesetzt: ${String(e)}`); }
    }
    if (req.playlistId) {
      try { await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: req.playlistId, resourceId: { kind: "youtube#video", videoId: id } } } }); } catch (e) { warnings.push(`Playlist nicht gesetzt: ${String(e)}`); }
    }
    const uploadStatus = res.data.status?.uploadStatus ?? "unknown";
    if (res.data.status?.privacyStatus === "private" && req.privacy !== "private" && !req.publishAt) warnings.push("YouTube hat das Video auf privat gesetzt – ggf. API-Audit des Google-Cloud-Projekts ausstehend.");
    return { externalVideoId: id, url: `https://www.youtube.com/watch?v=${id}`, status: uploadStatus, usage: [{ provider: "youtube", model: "videos.insert", units: 1600, unitType: "requests" }], warnings };
  }

  async setThumbnail(externalVideoId: string, thumbnailPath: string, channelId?: string): Promise<void> {
    if (!channelId) throw new ContentOsError("VALIDATION", "channelId erforderlich");
    const yt = await this.api(channelId);
    await yt.thumbnails.set({ videoId: externalVideoId, media: { mimeType: "image/png", body: createReadStream(thumbnailPath) } });
  }
}

/**
 * YouTube Analytics API v2. Verfügbar per API: views, watch time, avg view duration/percentage, subscribers, likes,
 * shares, comments, estimatedRevenue/cpm (Monetary-Scope), Retention (audienceWatchRatio), Traffic Sources, Geo.
 * NICHT per API: Impressions & Impressions-CTR (nur YouTube Studio) -> Status MANUAL.
 */
export class YouTubeAnalyticsProvider implements AnalyticsProvider {
  readonly name = "youtube";
  constructor(private readonly resolveAuth: (channelId: string) => Promise<YouTubeAuth>) {}

  private async api(channelId: string) {
    return google.youtubeAnalytics({ version: "v2", auth: oauthClient(await this.resolveAuth(channelId)) });
  }

  async fetchVideoStats(q: AnalyticsQuery) {
    const ya = await this.api(q.channelId);
    const metrics = ["views", "estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage", "subscribersGained", "likes", "shares", "comments"];
    const monetary = ["estimatedRevenue", "cpm", "playbackBasedCpm"];
    const run = async (m: string[]) => ya.reports.query({ ids: "channel==MINE", startDate: q.startDate, endDate: q.endDate, metrics: m.join(","), dimensions: q.externalVideoId ? undefined : "video", filters: q.externalVideoId ? `video==${q.externalVideoId}` : undefined, maxResults: 200 });
    const base = await run(metrics);
    let rows = toRows(base.data);
    try { const mon = await run(monetary); const mrows = toRows(mon.data); rows = rows.map((r, i) => ({ ...r, ...(mrows[i] ?? {}) })); } catch { /* Monetary-Scope evtl. nicht erteilt */ }
    return { rows, usage: [{ provider: "youtube", model: "analytics.reports.query", units: 2, unitType: "requests" as const }] };
  }

  async fetchRetention(q: AnalyticsQuery) {
    if (!q.externalVideoId) return { curve: [], usage: [] };
    const ya = await this.api(q.channelId);
    const res = await ya.reports.query({ ids: "channel==MINE", startDate: q.startDate, endDate: q.endDate, metrics: "audienceWatchRatio", dimensions: "elapsedVideoTimeRatio", filters: `video==${q.externalVideoId}` });
    const curve = (res.data.rows ?? []).map((r) => ({ pct: Number(r[0]), ratio: Number(r[1]) }));
    return { curve, usage: [{ provider: "youtube", model: "analytics.reports.query", units: 1, unitType: "requests" as const }] };
  }
}

function toRows(data: { columnHeaders?: { name?: string | null }[] | null; rows?: unknown[][] | null }): Record<string, unknown>[] {
  const headers = (data.columnHeaders ?? []).map((h) => h.name ?? "");
  return (data.rows ?? []).map((r) => Object.fromEntries(r.map((v, i) => [headers[i] ?? String(i), v])));
}
