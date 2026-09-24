import { google, type youtube_v3 } from "googleapis";
import { createReadStream } from "node:fs";
import type { AnalyticsProvider, AnalyticsQuery, PublishProvider, PublishRequest, PublishResult } from "@content-os/core";
import { CapacityExhaustedError, ContentOsError } from "@content-os/core";

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
 * YouTube Data API v3 – offizieller Upload (videos.insert: 1 Einheit im eigenen Upload-Topf, Default 100 Uploads/Tag).
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
      if ((e.code === 403 || e.code === 429) && /quota|rateLimit/i.test(e.message ?? "")) throw new CapacityExhaustedError("youtube", `YouTube-Quota erschöpft (Upload-Topf 100/Tag oder 10.000 Einheiten): ${e.message}`, 3600);
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
    // Quota (Stand 2026): videos.insert = 1 Einheit im eigenen Upload-Topf (Default 100 Uploads/Tag);
    // thumbnails.set/playlistItems.insert = je 50 Einheiten im allgemeinen 10.000er-Topf.
    const usage = [{ provider: "youtube", model: "videos.insert", units: 1, unitType: "requests" as const }];
    if (req.thumbnailPath) usage.push({ provider: "youtube", model: "thumbnails.set", units: 50, unitType: "requests" as const });
    if (req.playlistId) usage.push({ provider: "youtube", model: "playlistItems.insert", units: 50, unitType: "requests" as const });
    return { externalVideoId: id, url: `https://www.youtube.com/watch?v=${id}`, status: uploadStatus, usage, warnings };
  }

  async setThumbnail(externalVideoId: string, thumbnailPath: string, channelId?: string): Promise<void> {
    if (!channelId) throw new ContentOsError("VALIDATION", "channelId erforderlich");
    const yt = await this.api(channelId);
    await yt.thumbnails.set({ videoId: externalVideoId, media: { mimeType: "image/png", body: createReadStream(thumbnailPath) } });
  }
}

/**
 * YouTube Analytics API v2 (gezielte Abfragen): views, watch time, avg view duration/percentage, subscribers, likes,
 * shares, comments, engagedViews (Shorts), estimatedRevenue/cpm (Monetary-Scope + YPP), Retention (audienceWatchRatio).
 * Impressions & Impressions-CTR: YouTube Reporting API, Reach-Reports `channel_reach_basic_a1` (seit Jan. 2026),
 * Bulk-CSV, täglich erzeugt, erster Report bis ~48 h nach Job-Anlage -> fetchReach().
 * "Viewed vs. swiped away" (Shorts): nur YouTube Studio -> MANUAL.
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
    let calls = 1;
    // Optionale Zusatzmetriken getrennt abfragen, damit eine fehlende Berechtigung/Kompatibilität die Basis nicht bricht
    for (const extra of [monetary, ["engagedViews"]]) {
      try { calls++; const r = await run(extra); const xs = toRows(r.data); rows = rows.map((row, i) => ({ ...row, ...(xs[i] ?? {}) })); } catch { /* Scope/YPP/Metrik nicht verfügbar */ }
    }
    return { rows, usage: [{ provider: "youtube", model: "analytics.reports.query", units: calls, unitType: "requests" as const }] };
  }

  /**
   * Impressions + Impressions-CTR je Video aus der YouTube Reporting API (Reach-Report).
   * Legt den Reporting-Job beim ersten Aufruf an (idempotent), lädt danach alle neuen CSV-Reports.
   */
  async fetchReach(q: { channelId: string; since?: string }): Promise<{ rows: { videoId: string; date: string; impressions: number; ctr: number }[]; jobCreated: boolean; usage: { provider: string; model: string; units: number; unitType: "requests" }[] }> {
    const auth = oauthClient(await this.resolveAuth(q.channelId));
    const yr = google.youtubereporting({ version: "v1", auth });
    const reportTypeId = "channel_reach_basic_a1";
    const jobs = await yr.jobs.list({});
    let job = (jobs.data.jobs ?? []).find((j) => j.reportTypeId === reportTypeId);
    let jobCreated = false;
    if (!job) { job = (await yr.jobs.create({ requestBody: { reportTypeId, name: "content-os reach" } })).data; jobCreated = true; }
    const reports = job.id ? (await yr.jobs.reports.list({ jobId: job.id, createdAfter: q.since })).data.reports ?? [] : [];
    const rows: { videoId: string; date: string; impressions: number; ctr: number }[] = [];
    for (const r of reports) {
      if (!r.downloadUrl) continue;
      const res = await auth.request<string>({ url: r.downloadUrl, responseType: "text" });
      rows.push(...parseReachCsv(String(res.data)));
    }
    return { rows, jobCreated, usage: [{ provider: "youtube", model: "reporting", units: 2 + reports.length, unitType: "requests" }] };
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

/** Parst Reach-CSV (Spalten u. a. date, video_id, video_thumbnail_impressions, video_thumbnail_impressions_ctr) und aggregiert je Video+Tag. */
export function parseReachCsv(csv: string): { videoId: string; date: string; impressions: number; ctr: number }[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((h) => h.trim());
  const iv = header.indexOf("video_id"), id = header.indexOf("date"), ii = header.indexOf("video_thumbnail_impressions"), ic = header.indexOf("video_thumbnail_impressions_ctr");
  if (iv < 0 || ii < 0) return [];
  const agg = new Map<string, { videoId: string; date: string; impressions: number; clicks: number }>();
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const videoId = c[iv] ?? ""; const date = id >= 0 ? c[id] ?? "" : ""; const imp = Number(c[ii] ?? 0); const ctr = ic >= 0 ? Number(c[ic] ?? 0) : 0;
    if (!videoId) continue;
    const k = `${videoId}|${date}`;
    const cur = agg.get(k) ?? { videoId, date, impressions: 0, clicks: 0 };
    cur.impressions += imp; cur.clicks += imp * ctr;
    agg.set(k, cur);
  }
  return [...agg.values()].map((a) => ({ videoId: a.videoId, date: a.date, impressions: a.impressions, ctr: a.impressions ? a.clicks / a.impressions : 0 }));
}
