/**
 * Persistenz-Schnittstelle. Zwei Implementierungen:
 *  - MemoryStore (hier, für Tests/E2E ohne DB)
 *  - PgStore (@content-os/db, Drizzle/PostgreSQL)
 * Die Pipeline kennt nur dieses Interface.
 */
import type {
  AnalyticsSnapshot, Asset, Channel, CostEntry, Project, QAReport, ResearchDoc, Script, Stage, Storyboard, Topic, Video, VideoFormat,
} from "./domain.ts";
import type { SpendSnapshot, SpendSource } from "./budget/budget-guard.ts";
import type { UsageSink, UsageSummary } from "./usage/usage-manager.ts";
import { newId } from "./ids.ts";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string; // "system:worker" | "user:<id>" | "api"
  action: string; // "video.transition", "video.approve", "provider.call", ...
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}

export interface ReviewDecision {
  id: string;
  videoId: string;
  reviewer: string;
  decision: "APPROVE" | "REJECT" | "REGENERATE" | "FIX";
  targetStage?: Stage;
  notes?: string;
  at: string;
}

export interface VideoFilter { projectId?: string; stage?: Stage | Stage[]; status?: Video["status"] | Video["status"][]; format?: VideoFormat; limit?: number }

export interface AssetReuseQuery { projectId: string; kind: Asset["kind"]; tags?: string[]; promptHash?: string; excludeVideoId?: string; limit?: number }

export interface Store {
  projects: {
    create(p: Omit<Project, "id"> & { id?: string }): Promise<Project>;
    get(id: string): Promise<Project | undefined>;
    getBySlug(slug: string): Promise<Project | undefined>;
    list(): Promise<Project[]>;
    update(id: string, patch: Partial<Project>): Promise<Project>;
  };
  channels: {
    create(c: Omit<Channel, "id"> & { id?: string }): Promise<Channel>;
    get(id: string): Promise<Channel | undefined>;
    listByProject(projectId: string): Promise<Channel[]>;
    update(id: string, patch: Partial<Channel>): Promise<Channel>;
  };
  topics: {
    create(t: Omit<Topic, "id"> & { id?: string }): Promise<Topic>;
    get(id: string): Promise<Topic | undefined>;
    listByProject(projectId: string, status?: Topic["status"]): Promise<Topic[]>;
    update(id: string, patch: Partial<Topic>): Promise<Topic>;
  };
  research: { create(r: Omit<ResearchDoc, "id"> & { id?: string }): Promise<ResearchDoc>; get(id: string): Promise<ResearchDoc | undefined> };
  scripts: {
    create(s: Omit<Script, "id"> & { id?: string }): Promise<Script>;
    get(id: string): Promise<Script | undefined>;
    listByProject(projectId: string): Promise<Script[]>;
  };
  storyboards: {
    create(s: Omit<Storyboard, "id"> & { id?: string }): Promise<Storyboard>;
    get(id: string): Promise<Storyboard | undefined>;
    listByProject(projectId: string): Promise<Storyboard[]>;
    update(id: string, patch: Partial<Storyboard>): Promise<Storyboard>;
  };
  assets: {
    create(a: Omit<Asset, "id" | "createdAt"> & { id?: string; createdAt?: string }): Promise<Asset>;
    get(id: string): Promise<Asset | undefined>;
    update(id: string, patch: Partial<Asset>): Promise<Asset>;
    listByVideo(videoId: string): Promise<Asset[]>;
    findReusable(q: AssetReuseQuery): Promise<Asset[]>;
  };
  videos: {
    create(v: Omit<Video, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Video>;
    get(id: string): Promise<Video | undefined>;
    list(f: VideoFilter): Promise<Video[]>;
    update(id: string, patch: Partial<Video>): Promise<Video>;
    /** Anzahl Videos eines Projekts, die heute (UTC) in Produktion gestartet wurden (Scale-Gate). */
    countStartedToday(projectId: string, now: Date): Promise<number>;
  };
  qa: { create(q: Omit<QAReport, "id" | "createdAt"> & { id?: string }): Promise<QAReport>; get(id: string): Promise<QAReport | undefined> };
  costs: SpendSource & UsageSink & {
    list(f: { projectId?: string; videoId?: string; since?: Date }): Promise<(CostEntry & { failed: boolean; retry: boolean })[]>;
    summarize(f: { projectId?: string; videoId?: string; since?: Date }): Promise<UsageSummary>;
  };
  analytics: {
    upsert(s: Omit<AnalyticsSnapshot, "id"> & { id?: string }): Promise<AnalyticsSnapshot>;
    listByVideo(videoId: string): Promise<AnalyticsSnapshot[]>;
  };
  reviews: { create(r: Omit<ReviewDecision, "id" | "at"> & { id?: string }): Promise<ReviewDecision>; listByVideo(videoId: string): Promise<ReviewDecision[]> };
  audit: { log(e: Omit<AuditEntry, "id" | "at">): Promise<void>; list(f: { entityId?: string; limit?: number }): Promise<AuditEntry[]> };
}

// ---------------------------------------------------------------------------
// In-Memory-Implementierung
// ---------------------------------------------------------------------------

class Table<T extends { id: string }> {
  readonly rows = new Map<string, T>();
  insert(row: T): T { this.rows.set(row.id, structuredClone(row)); return structuredClone(row); }
  get(id: string): T | undefined { const r = this.rows.get(id); return r ? structuredClone(r) : undefined; }
  update(id: string, patch: Partial<T>): T {
    const cur = this.rows.get(id);
    if (!cur) throw new Error(`not found: ${id}`);
    const next = { ...cur, ...patch } as T;
    this.rows.set(id, next);
    return structuredClone(next);
  }
  all(): T[] { return [...this.rows.values()].map((r) => structuredClone(r)); }
}

function summarizeEntries(entries: (CostEntry & { failed: boolean; retry: boolean })[]): UsageSummary {
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
}

export function createMemoryStore(): Store {
  const projects = new Table<Project>();
  const channels = new Table<Channel>();
  const topics = new Table<Topic>();
  const research = new Table<ResearchDoc>();
  const scripts = new Table<Script>();
  const storyboards = new Table<Storyboard>();
  const assets = new Table<Asset>();
  const videos = new Table<Video>();
  const qa = new Table<QAReport>();
  const costs: (CostEntry & { failed: boolean; retry: boolean })[] = [];
  const analytics = new Table<AnalyticsSnapshot>();
  const reviews = new Table<ReviewDecision>();
  const audit: AuditEntry[] = [];
  const now = () => new Date().toISOString();

  const store: Store = {
    projects: {
      async create(p) { return projects.insert({ ...p, id: p.id ?? newId("prj") } as Project); },
      async get(id) { return projects.get(id); },
      async getBySlug(slug) { return projects.all().find((p) => p.slug === slug); },
      async list() { return projects.all(); },
      async update(id, patch) { return projects.update(id, patch); },
    },
    channels: {
      async create(c) { return channels.insert({ ...c, id: c.id ?? newId("chn") } as Channel); },
      async get(id) { return channels.get(id); },
      async listByProject(projectId) { return channels.all().filter((c) => c.projectId === projectId); },
      async update(id, patch) { return channels.update(id, patch); },
    },
    topics: {
      async create(t) { return topics.insert({ ...t, id: t.id ?? newId("top") } as Topic); },
      async get(id) { return topics.get(id); },
      async listByProject(projectId, status) { return topics.all().filter((t) => t.projectId === projectId && (!status || t.status === status)); },
      async update(id, patch) { return topics.update(id, patch); },
    },
    research: {
      async create(r) { return research.insert({ ...r, id: r.id ?? newId("res") } as ResearchDoc); },
      async get(id) { return research.get(id); },
    },
    scripts: {
      async create(s) { return scripts.insert({ ...s, id: s.id ?? newId("scr") } as Script); },
      async get(id) { return scripts.get(id); },
      async listByProject(projectId) {
        const topicIds = new Set(topics.all().filter((t) => t.projectId === projectId).map((t) => t.id));
        return scripts.all().filter((s) => topicIds.has(s.topicId));
      },
    },
    storyboards: {
      async create(s) { return storyboards.insert({ ...s, id: s.id ?? newId("stb") } as Storyboard); },
      async get(id) { return storyboards.get(id); },
      async update(id, patch) { return storyboards.update(id, patch); },
      async listByProject(projectId) {
        const scriptIds = new Set((await store.scripts.listByProject(projectId)).map((s) => s.id));
        return storyboards.all().filter((s) => scriptIds.has(s.scriptId));
      },
    },
    assets: {
      async create(a) { return assets.insert({ ...a, id: a.id ?? newId("ast"), createdAt: a.createdAt ?? now() } as Asset); },
      async get(id) { return assets.get(id); },
      async update(id, patch) { return assets.update(id, patch); },
      async listByVideo(videoId) { return assets.all().filter((a) => a.videoId === videoId); },
      async findReusable(q) {
        return assets.all().filter((a) => a.projectId === q.projectId && a.kind === q.kind
          && (!q.promptHash || a.promptHash === q.promptHash)
          && (!q.tags?.length || q.tags.every((t) => a.tags.includes(t)))
          && (!q.excludeVideoId || a.videoId !== q.excludeVideoId)).slice(0, q.limit ?? 10);
      },
    },
    videos: {
      async create(v) { const t = now(); return videos.insert({ ...v, id: v.id ?? newId("vid"), createdAt: t, updatedAt: t } as Video); },
      async get(id) { return videos.get(id); },
      async list(f) {
        const st = f.stage ? (Array.isArray(f.stage) ? f.stage : [f.stage]) : undefined;
        const ss = f.status ? (Array.isArray(f.status) ? f.status : [f.status]) : undefined;
        return videos.all().filter((v) => (!f.projectId || v.projectId === f.projectId) && (!st || st.includes(v.stage)) && (!ss || ss.includes(v.status)) && (!f.format || v.format === f.format))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, f.limit ?? 1000);
      },
      async update(id, patch) { return videos.update(id, { ...patch, updatedAt: now() }); },
      async countStartedToday(projectId, at) {
        const day = at.toISOString().slice(0, 10);
        return videos.all().filter((v) => v.projectId === projectId && v.createdAt.slice(0, 10) === day && v.stage !== "IDEA" && v.stage !== "SCORED" && v.stage !== "SELECTED").length;
      },
    },
    qa: {
      async create(q) { return qa.insert({ ...q, id: q.id ?? newId("qa"), createdAt: now() } as QAReport); },
      async get(id) { return qa.get(id); },
    },
    costs: {
      async record(entry) { costs.push(structuredClone(entry)); },
      async snapshot(input): Promise<SpendSnapshot> {
        const dayStart = new Date(input.now); dayStart.setUTCHours(0, 0, 0, 0);
        const monthStart = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), 1));
        const sum = (pred: (e: CostEntry) => boolean) => costs.filter(pred).reduce((a, e) => a + e.costEur, 0);
        const at = (e: CostEntry) => new Date(e.createdAt);
        return {
          videoEur: input.videoId ? sum((e) => e.videoId === input.videoId) : 0,
          projectDailyEur: input.projectId ? sum((e) => e.projectId === input.projectId && at(e) >= dayStart) : 0,
          dailyEur: sum((e) => at(e) >= dayStart),
          monthlyEur: sum((e) => at(e) >= monthStart),
          providerMonthlyEur: sum((e) => e.provider === input.provider && at(e) >= monthStart),
        };
      },
      async list(f) { return costs.filter((e) => (!f.projectId || e.projectId === f.projectId) && (!f.videoId || e.videoId === f.videoId) && (!f.since || new Date(e.createdAt) >= f.since)).map((e) => structuredClone(e)); },
      async summarize(f) { return summarizeEntries(await store.costs.list(f)); },
    },
    analytics: {
      async upsert(s) {
        const existing = analytics.all().find((a) => a.videoId === s.videoId && a.capturedAt === s.capturedAt && a.windowDays === s.windowDays);
        if (existing) return analytics.update(existing.id, s as Partial<AnalyticsSnapshot>);
        return analytics.insert({ ...s, id: s.id ?? newId("ana") } as AnalyticsSnapshot);
      },
      async listByVideo(videoId) { return analytics.all().filter((a) => a.videoId === videoId); },
    },
    reviews: {
      async create(r) { return reviews.insert({ ...r, id: r.id ?? newId("rev"), at: now() } as ReviewDecision); },
      async listByVideo(videoId) { return reviews.all().filter((r) => r.videoId === videoId); },
    },
    audit: {
      async log(e) { audit.push({ ...e, id: newId("aud"), at: now() }); },
      async list(f) { return audit.filter((a) => !f.entityId || a.entityId === f.entityId).slice(-(f.limit ?? 100)); },
    },
  };
  return store;
}
