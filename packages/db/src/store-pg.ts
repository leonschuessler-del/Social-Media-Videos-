import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type {
  AnalyticsSnapshot, Asset, AuditEntry, Channel, CostEntry, Project, QAReport, ResearchDoc, ReviewDecision, Script, Store, Storyboard, Topic, Video, SpendSnapshot, UsageSummary,
} from "@content-os/core";
import { newId } from "@content-os/core";
import type { Db } from "./client.ts";
import * as t from "./schema.ts";

type Row<T> = T extends { $inferSelect: infer S } ? S : never;

function rowToProject(r: Row<typeof t.projects>): Project {
  return { id: r.id, slug: r.slug, name: r.name, niche: r.niche, language: r.language, reviewMode: r.reviewMode as Project["reviewMode"], maxVideosPerDay: r.maxVideosPerDay, autoApproveThreshold: r.autoApproveThreshold, minPublishScore: r.minPublishScore, styleGuide: r.styleGuide as Project["styleGuide"], rulesVersion: r.rulesVersion, active: r.active };
}
function rowToChannel(r: Row<typeof t.channels>): Channel {
  return { id: r.id, projectId: r.projectId, platform: r.platform as Channel["platform"], name: r.name, externalChannelId: r.externalChannelId ?? undefined, credentialsRef: r.credentialsRef ?? undefined, defaultPrivacy: r.defaultPrivacy as Channel["defaultPrivacy"], defaultPublishHourLocal: r.defaultPublishHourLocal, timezone: r.timezone, active: r.active };
}
function rowToTopic(r: Row<typeof t.topics>): Topic {
  return { id: r.id, projectId: r.projectId, title: r.title, angle: r.angle, format: r.format as Topic["format"], language: r.language, source: r.source as Topic["source"], factors: (r.factors as Topic["factors"]) ?? undefined, score: r.score ?? undefined, status: r.status as Topic["status"], originalityCheck: (r.originalityCheck as Topic["originalityCheck"]) ?? undefined, tags: (r.tags as string[]) ?? [] };
}
function rowToResearch(r: Row<typeof t.researchDocs>): ResearchDoc {
  return { id: r.id, topicId: r.topicId, summary: r.summary, keyFacts: r.keyFacts as string[], claims: r.claims as ResearchDoc["claims"], sources: r.sources as ResearchDoc["sources"], openQuestions: r.openQuestions as string[], riskFlags: r.riskFlags as string[], model: r.model };
}
function rowToScript(r: Row<typeof t.scripts>): Script {
  return { id: r.id, topicId: r.topicId, format: r.format as Script["format"], language: r.language, title: r.title, hookType: r.hookType as Script["hookType"], sections: r.sections as Script["sections"], fullNarration: r.fullNarration, estimatedSeconds: r.estimatedSeconds, wordCount: r.wordCount, model: r.model, version: r.version };
}
function rowToStoryboard(r: Row<typeof t.storyboards>): Storyboard {
  return { id: r.id, scriptId: r.scriptId, aspect: r.aspect as Storyboard["aspect"], scenes: r.scenes as Storyboard["scenes"], visualStyle: r.visualStyle, colorPalette: r.colorPalette as string[], model: r.model };
}
function rowToAsset(r: Row<typeof t.assets>): Asset {
  return { id: r.id, projectId: r.projectId, kind: r.kind as Asset["kind"], storageKey: r.storageKey, mimeType: r.mimeType, width: r.width ?? undefined, height: r.height ?? undefined, durationSec: r.durationSec ?? undefined, sizeBytes: r.sizeBytes ?? undefined, provider: r.provider, model: r.model ?? undefined, prompt: r.prompt ?? undefined, promptHash: r.promptHash ?? undefined, topicId: r.topicId ?? undefined, sceneId: r.sceneId ?? undefined, videoId: r.videoId ?? undefined, rights: r.rights as Asset["rights"], usedInVideoIds: r.usedInVideoIds as string[], tags: r.tags as string[], createdAt: r.createdAt };
}
function rowToVideo(r: Row<typeof t.videos>): Video {
  return { id: r.id, projectId: r.projectId, channelId: r.channelId ?? undefined, topicId: r.topicId, format: r.format as Video["format"], language: r.language, stage: r.stage as Video["stage"], status: r.status as Video["status"], stageAttempt: r.stageAttempt, researchId: r.researchId ?? undefined, scriptId: r.scriptId ?? undefined, storyboardId: r.storyboardId ?? undefined, renderAssetId: r.renderAssetId ?? undefined, thumbnailAssetId: r.thumbnailAssetId ?? undefined, qaReportId: r.qaReportId ?? undefined, metadata: (r.metadata as Video["metadata"]) ?? undefined, experiment: (r.experiment as Video["experiment"]) ?? undefined, qualityScore: r.qualityScore ?? undefined, costEur: r.costEur, statusReason: r.statusReason ?? undefined, resumeAfter: r.resumeAfter ?? undefined, externalVideoId: r.externalVideoId ?? undefined, scheduledFor: r.scheduledFor ?? undefined, publishedAt: r.publishedAt ?? undefined, parentVideoId: r.parentVideoId ?? undefined, createdAt: r.createdAt, updatedAt: r.updatedAt };
}
function rowToQa(r: Row<typeof t.qaReports>): QAReport {
  return { id: r.id, videoId: r.videoId, checks: r.checks as QAReport["checks"], score: r.score as QAReport["score"], decision: r.decision as QAReport["decision"], reasons: r.reasons as string[], createdAt: r.createdAt };
}
function rowToCost(r: Row<typeof t.costEntries>): CostEntry & { failed: boolean; retry: boolean } {
  return { id: r.id, projectId: r.projectId ?? undefined, videoId: r.videoId ?? undefined, stage: (r.stage as CostEntry["stage"]) ?? undefined, provider: r.provider, model: r.model, capability: r.capability as CostEntry["capability"], units: r.units, unitType: r.unitType as CostEntry["unitType"], costUsd: r.costUsd, costEur: r.costEur, coveredByQuota: r.coveredByQuota, requestId: r.requestId ?? undefined, createdAt: r.createdAt, failed: r.failed, retry: r.retry };
}
function rowToAnalytics(r: Row<typeof t.analyticsSnapshots>): AnalyticsSnapshot {
  return { id: r.id, videoId: r.videoId, channelId: r.channelId, capturedAt: r.capturedAt, windowDays: r.windowDays, ...(r.metrics as Record<string, unknown>) } as AnalyticsSnapshot;
}

function undef<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

export function createPgStore(db: Db): Store {
  const summarize = (entries: (CostEntry & { failed: boolean; retry: boolean })[]): UsageSummary => {
    const s: UsageSummary = { textJobs: 0, images: 0, videoClips: 0, videoSeconds: 0, ttsCharacters: 0, retries: 0, failures: 0, costUsd: 0, costEur: 0, coveredByQuotaUsd: 0 };
    for (const e of entries) {
      if (e.capability.startsWith("llm") || e.capability.startsWith("search")) s.textJobs += 1;
      if (e.capability.startsWith("image")) s.images += e.units;
      if (e.capability.startsWith("video")) { s.videoClips += 1; s.videoSeconds += e.units; }
      if (e.capability === "tts") s.ttsCharacters += e.units;
      if (e.retry) s.retries += 1;
      if (e.failed) s.failures += 1;
      s.costUsd += e.costUsd; s.costEur += e.costEur;
      if (e.coveredByQuota) s.coveredByQuotaUsd += e.costUsd;
    }
    return s;
  };

  const store: Store = {
    projects: {
      async create(p) { const id = p.id ?? newId("prj"); const [r] = await db.insert(t.projects).values({ ...undef({ ...p }), id }).returning(); return rowToProject(r!); },
      async get(id) { const [r] = await db.select().from(t.projects).where(eq(t.projects.id, id)); return r ? rowToProject(r) : undefined; },
      async getBySlug(slug) { const [r] = await db.select().from(t.projects).where(eq(t.projects.slug, slug)); return r ? rowToProject(r) : undefined; },
      async list() { return (await db.select().from(t.projects).orderBy(t.projects.createdAt)).map(rowToProject); },
      async update(id, patch) { const [r] = await db.update(t.projects).set(undef({ ...patch })).where(eq(t.projects.id, id)).returning(); return rowToProject(r!); },
    },
    channels: {
      async create(c) { const id = c.id ?? newId("chn"); const [r] = await db.insert(t.channels).values({ ...undef({ ...c }), id }).returning(); return rowToChannel(r!); },
      async get(id) { const [r] = await db.select().from(t.channels).where(eq(t.channels.id, id)); return r ? rowToChannel(r) : undefined; },
      async listByProject(projectId) { return (await db.select().from(t.channels).where(eq(t.channels.projectId, projectId))).map(rowToChannel); },
      async update(id, patch) { const [r] = await db.update(t.channels).set(undef({ ...patch })).where(eq(t.channels.id, id)).returning(); return rowToChannel(r!); },
    },
    topics: {
      async create(tp) { const id = tp.id ?? newId("top"); const [r] = await db.insert(t.topics).values({ ...undef({ ...tp }), id }).returning(); return rowToTopic(r!); },
      async get(id) { const [r] = await db.select().from(t.topics).where(eq(t.topics.id, id)); return r ? rowToTopic(r) : undefined; },
      async listByProject(projectId, status) {
        const where = status ? and(eq(t.topics.projectId, projectId), eq(t.topics.status, status)) : eq(t.topics.projectId, projectId);
        return (await db.select().from(t.topics).where(where).orderBy(desc(t.topics.score))).map(rowToTopic);
      },
      async update(id, patch) { const [r] = await db.update(t.topics).set(undef({ ...patch })).where(eq(t.topics.id, id)).returning(); return rowToTopic(r!); },
    },
    research: {
      async create(rd) { const id = rd.id ?? newId("res"); const [r] = await db.insert(t.researchDocs).values({ ...undef({ ...rd }), id }).returning(); return rowToResearch(r!); },
      async get(id) { const [r] = await db.select().from(t.researchDocs).where(eq(t.researchDocs.id, id)); return r ? rowToResearch(r) : undefined; },
    },
    scripts: {
      async create(s) { const id = s.id ?? newId("scr"); const [r] = await db.insert(t.scripts).values({ ...undef({ ...s }), id }).returning(); return rowToScript(r!); },
      async get(id) { const [r] = await db.select().from(t.scripts).where(eq(t.scripts.id, id)); return r ? rowToScript(r) : undefined; },
      async listByProject(projectId) {
        const rows = await db.select({ s: t.scripts }).from(t.scripts).innerJoin(t.topics, eq(t.scripts.topicId, t.topics.id)).where(eq(t.topics.projectId, projectId));
        return rows.map((r) => rowToScript(r.s));
      },
    },
    storyboards: {
      async create(s) { const id = s.id ?? newId("stb"); const [r] = await db.insert(t.storyboards).values({ ...undef({ ...s }), id }).returning(); return rowToStoryboard(r!); },
      async get(id) { const [r] = await db.select().from(t.storyboards).where(eq(t.storyboards.id, id)); return r ? rowToStoryboard(r) : undefined; },
      async update(id, patch) { const [r] = await db.update(t.storyboards).set(undef({ ...patch })).where(eq(t.storyboards.id, id)).returning(); return rowToStoryboard(r!); },
      async listByProject(projectId) {
        const rows = await db.select({ sb: t.storyboards }).from(t.storyboards).innerJoin(t.scripts, eq(t.storyboards.scriptId, t.scripts.id)).innerJoin(t.topics, eq(t.scripts.topicId, t.topics.id)).where(eq(t.topics.projectId, projectId));
        return rows.map((r) => rowToStoryboard(r.sb));
      },
    },
    assets: {
      async create(a) { const id = a.id ?? newId("ast"); const [r] = await db.insert(t.assets).values({ ...undef({ ...a }), id }).returning(); return rowToAsset(r!); },
      async get(id) { const [r] = await db.select().from(t.assets).where(eq(t.assets.id, id)); return r ? rowToAsset(r) : undefined; },
      async update(id, patch) { const [r] = await db.update(t.assets).set(undef({ ...patch })).where(eq(t.assets.id, id)).returning(); return rowToAsset(r!); },
      async listByVideo(videoId) { return (await db.select().from(t.assets).where(eq(t.assets.videoId, videoId))).map(rowToAsset); },
      async findReusable(q) {
        const conds: SQL[] = [eq(t.assets.projectId, q.projectId), eq(t.assets.kind, q.kind)];
        if (q.promptHash) conds.push(eq(t.assets.promptHash, q.promptHash));
        if (q.tags?.length) conds.push(sql`${t.assets.tags} @> ${JSON.stringify(q.tags)}::jsonb`);
        if (q.excludeVideoId) conds.push(sql`${t.assets.videoId} IS DISTINCT FROM ${q.excludeVideoId}`);
        return (await db.select().from(t.assets).where(and(...conds)).orderBy(desc(t.assets.createdAt)).limit(q.limit ?? 10)).map(rowToAsset);
      },
    },
    videos: {
      async create(v) { const id = v.id ?? newId("vid"); const [r] = await db.insert(t.videos).values({ ...undef({ ...v }), id }).returning(); return rowToVideo(r!); },
      async get(id) { const [r] = await db.select().from(t.videos).where(eq(t.videos.id, id)); return r ? rowToVideo(r) : undefined; },
      async list(f) {
        const conds: SQL[] = [];
        if (f.projectId) conds.push(eq(t.videos.projectId, f.projectId));
        if (f.stage) conds.push(Array.isArray(f.stage) ? inArray(t.videos.stage, f.stage) : eq(t.videos.stage, f.stage));
        if (f.status) conds.push(Array.isArray(f.status) ? inArray(t.videos.status, f.status) : eq(t.videos.status, f.status));
        if (f.format) conds.push(eq(t.videos.format, f.format));
        const q = db.select().from(t.videos).where(conds.length ? and(...conds) : undefined).orderBy(t.videos.createdAt).limit(f.limit ?? 1000);
        return (await q).map(rowToVideo);
      },
      async update(id, patch) { const [r] = await db.update(t.videos).set({ ...undef({ ...patch }), updatedAt: new Date().toISOString() }).where(eq(t.videos.id, id)).returning(); return rowToVideo(r!); },
      async countStartedToday(projectId, now) {
        const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
        const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(t.videos).where(and(eq(t.videos.projectId, projectId), gte(t.videos.createdAt, dayStart.toISOString()), sql`${t.videos.stage} NOT IN ('IDEA','SCORED','SELECTED')`));
        return r?.c ?? 0;
      },
    },
    qa: {
      async create(q) { const id = q.id ?? newId("qa"); const [r] = await db.insert(t.qaReports).values({ ...undef({ ...q }), id }).returning(); return rowToQa(r!); },
      async get(id) { const [r] = await db.select().from(t.qaReports).where(eq(t.qaReports.id, id)); return r ? rowToQa(r) : undefined; },
    },
    costs: {
      async record(e) { await db.insert(t.costEntries).values(undef({ ...e })); },
      async snapshot(input): Promise<SpendSnapshot> {
        const dayStart = new Date(input.now); dayStart.setUTCHours(0, 0, 0, 0);
        const monthStart = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), 1));
        const sumWhere = async (w: SQL | undefined) => { const [r] = await db.select({ s: sql<number>`coalesce(sum(${t.costEntries.costEur}),0)::float` }).from(t.costEntries).where(w); return r?.s ?? 0; };
        return {
          videoEur: input.videoId ? await sumWhere(eq(t.costEntries.videoId, input.videoId)) : 0,
          projectDailyEur: input.projectId ? await sumWhere(and(eq(t.costEntries.projectId, input.projectId), gte(t.costEntries.createdAt, dayStart.toISOString()))) : 0,
          dailyEur: await sumWhere(gte(t.costEntries.createdAt, dayStart.toISOString())),
          monthlyEur: await sumWhere(gte(t.costEntries.createdAt, monthStart.toISOString())),
          providerMonthlyEur: await sumWhere(and(eq(t.costEntries.provider, input.provider), gte(t.costEntries.createdAt, monthStart.toISOString()))),
        };
      },
      async list(f) {
        const conds: SQL[] = [];
        if (f.projectId) conds.push(eq(t.costEntries.projectId, f.projectId));
        if (f.videoId) conds.push(eq(t.costEntries.videoId, f.videoId));
        if (f.since) conds.push(gte(t.costEntries.createdAt, f.since.toISOString()));
        return (await db.select().from(t.costEntries).where(conds.length ? and(...conds) : undefined).orderBy(t.costEntries.createdAt)).map(rowToCost);
      },
      async summarize(f) { return summarize(await store.costs.list(f)); },
    },
    analytics: {
      async upsert(s) {
        const { id: _id, videoId, channelId, capturedAt, windowDays, ...metrics } = s as AnalyticsSnapshot;
        const id = s.id ?? newId("ana");
        const [r] = await db.insert(t.analyticsSnapshots).values({ id, videoId, channelId, capturedAt, windowDays, metrics })
          .onConflictDoUpdate({ target: [t.analyticsSnapshots.videoId, t.analyticsSnapshots.capturedAt, t.analyticsSnapshots.windowDays], set: { metrics } }).returning();
        return rowToAnalytics(r!);
      },
      async listByVideo(videoId) { return (await db.select().from(t.analyticsSnapshots).where(eq(t.analyticsSnapshots.videoId, videoId)).orderBy(t.analyticsSnapshots.capturedAt)).map(rowToAnalytics); },
    },
    reviews: {
      async create(rv) { const id = rv.id ?? newId("rev"); const [r] = await db.insert(t.reviewDecisions).values({ ...undef({ ...rv }), id }).returning(); return { id: r!.id, videoId: r!.videoId, reviewer: r!.reviewer, decision: r!.decision as ReviewDecision["decision"], targetStage: (r!.targetStage as ReviewDecision["targetStage"]) ?? undefined, notes: r!.notes ?? undefined, at: r!.at }; },
      async listByVideo(videoId) { return (await db.select().from(t.reviewDecisions).where(eq(t.reviewDecisions.videoId, videoId))).map((r) => ({ id: r.id, videoId: r.videoId, reviewer: r.reviewer, decision: r.decision as ReviewDecision["decision"], targetStage: (r.targetStage as ReviewDecision["targetStage"]) ?? undefined, notes: r.notes ?? undefined, at: r.at })); },
    },
    audit: {
      async log(e) { await db.insert(t.auditLog).values({ ...e, id: newId("aud") }); },
      async list(f) {
        const rows = await db.select().from(t.auditLog).where(f.entityId ? eq(t.auditLog.entityId, f.entityId) : undefined).orderBy(desc(t.auditLog.at)).limit(f.limit ?? 100);
        return rows.map((r): AuditEntry => ({ id: r.id, at: r.at, actor: r.actor, action: r.action, entityType: r.entityType, entityId: r.entityId, details: r.details as Record<string, unknown> }));
      },
    },
  };
  return store;
}
