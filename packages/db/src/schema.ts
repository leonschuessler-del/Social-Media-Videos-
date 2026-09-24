import { pgTable, text, integer, boolean, jsonb, timestamp, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  language: text("language").notNull().default("de"),
  reviewMode: text("review_mode").notNull().default("SAFE"),
  maxVideosPerDay: integer("max_videos_per_day").notNull().default(1),
  autoApproveThreshold: doublePrecision("auto_approve_threshold").notNull().default(0.85),
  minPublishScore: doublePrecision("min_publish_score").notNull().default(0.65),
  styleGuide: jsonb("style_guide").notNull(),
  rulesVersion: integer("rules_version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const channels = pgTable("channels", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  externalChannelId: text("external_channel_id"),
  credentialsRef: text("credentials_ref"),
  defaultPrivacy: text("default_privacy").notNull().default("private"),
  defaultPublishHourLocal: integer("default_publish_hour_local").notNull().default(17),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  active: boolean("active").notNull().default(true),
}, (t) => [index("channels_project_idx").on(t.projectId)]);

/** Verschlüsselte Secrets (z.B. YouTube Refresh-Tokens). Nur Ciphertext + IV. */
export const secrets = pgTable("secrets", {
  ref: text("ref").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  tag: text("tag").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  angle: text("angle").notNull().default(""),
  format: text("format").notNull(),
  language: text("language").notNull().default("de"),
  source: text("source").notNull().default("manual"),
  factors: jsonb("factors"),
  score: doublePrecision("score"),
  status: text("status").notNull().default("NEW"),
  originalityCheck: jsonb("originality_check"),
  tags: jsonb("tags").notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("topics_project_status_idx").on(t.projectId, t.status)]);

export const researchDocs = pgTable("research_docs", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => topics.id),
  summary: text("summary").notNull(),
  keyFacts: jsonb("key_facts").notNull(),
  claims: jsonb("claims").notNull(),
  sources: jsonb("sources").notNull(),
  openQuestions: jsonb("open_questions").notNull().default([]),
  riskFlags: jsonb("risk_flags").notNull().default([]),
  model: text("model").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const scripts = pgTable("scripts", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => topics.id),
  format: text("format").notNull(),
  language: text("language").notNull(),
  title: text("title").notNull(),
  hookType: text("hook_type").notNull(),
  sections: jsonb("sections").notNull(),
  fullNarration: text("full_narration").notNull(),
  estimatedSeconds: doublePrecision("estimated_seconds").notNull(),
  wordCount: integer("word_count").notNull(),
  model: text("model").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("scripts_topic_idx").on(t.topicId)]);

export const storyboards = pgTable("storyboards", {
  id: text("id").primaryKey(),
  scriptId: text("script_id").notNull().references(() => scripts.id),
  aspect: text("aspect").notNull(),
  scenes: jsonb("scenes").notNull(),
  visualStyle: text("visual_style").notNull(),
  colorPalette: jsonb("color_palette").notNull().default([]),
  model: text("model").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  kind: text("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSec: doublePrecision("duration_sec"),
  sizeBytes: integer("size_bytes"),
  provider: text("provider").notNull(),
  model: text("model"),
  prompt: text("prompt"),
  promptHash: text("prompt_hash"),
  topicId: text("topic_id"),
  sceneId: text("scene_id"),
  videoId: text("video_id"),
  rights: jsonb("rights").notNull(),
  usedInVideoIds: jsonb("used_in_video_ids").notNull().default([]),
  tags: jsonb("tags").notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("assets_project_kind_idx").on(t.projectId, t.kind), index("assets_video_idx").on(t.videoId), index("assets_prompt_hash_idx").on(t.promptHash)]);

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  channelId: text("channel_id"),
  topicId: text("topic_id").notNull().references(() => topics.id),
  format: text("format").notNull(),
  language: text("language").notNull(),
  stage: text("stage").notNull().default("IDEA"),
  status: text("status").notNull().default("QUEUED"),
  stageAttempt: integer("stage_attempt").notNull().default(0),
  researchId: text("research_id"),
  scriptId: text("script_id"),
  storyboardId: text("storyboard_id"),
  renderAssetId: text("render_asset_id"),
  thumbnailAssetId: text("thumbnail_asset_id"),
  qaReportId: text("qa_report_id"),
  metadata: jsonb("metadata"),
  experiment: jsonb("experiment"),
  qualityScore: doublePrecision("quality_score"),
  costEur: doublePrecision("cost_eur").notNull().default(0),
  statusReason: text("status_reason"),
  resumeAfter: ts("resume_after"),
  externalVideoId: text("external_video_id"),
  scheduledFor: ts("scheduled_for"),
  publishedAt: ts("published_at"),
  parentVideoId: text("parent_video_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("videos_project_stage_idx").on(t.projectId, t.stage, t.status), index("videos_created_idx").on(t.createdAt)]);

export const qaReports = pgTable("qa_reports", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  checks: jsonb("checks").notNull(),
  score: jsonb("score").notNull(),
  decision: text("decision").notNull(),
  reasons: jsonb("reasons").notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("qa_video_idx").on(t.videoId)]);

/** Kosten- & Usage-Ledger: jeder Provider-Call. */
export const costEntries = pgTable("cost_entries", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  videoId: text("video_id"),
  stage: text("stage"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  capability: text("capability").notNull(),
  units: doublePrecision("units").notNull(),
  unitType: text("unit_type").notNull(),
  costUsd: doublePrecision("cost_usd").notNull(),
  costEur: doublePrecision("cost_eur").notNull(),
  coveredByQuota: boolean("covered_by_quota").notNull().default(false),
  failed: boolean("failed").notNull().default(false),
  retry: boolean("retry").notNull().default(false),
  requestId: text("request_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("costs_created_idx").on(t.createdAt), index("costs_video_idx").on(t.videoId), index("costs_project_created_idx").on(t.projectId, t.createdAt)]);

export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  channelId: text("channel_id").notNull(),
  capturedAt: ts("captured_at").notNull(),
  windowDays: integer("window_days").notNull(),
  metrics: jsonb("metrics").notNull(),
}, (t) => [uniqueIndex("analytics_unique_idx").on(t.videoId, t.capturedAt, t.windowDays)]);

export const reviewDecisions = pgTable("review_decisions", {
  id: text("id").primaryKey(),
  videoId: text("video_id").notNull().references(() => videos.id),
  reviewer: text("reviewer").notNull(),
  decision: text("decision").notNull(),
  targetStage: text("target_stage"),
  notes: text("notes"),
  at: ts("at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details").notNull().default({}),
}, (t) => [index("audit_entity_idx").on(t.entityId), index("audit_at_idx").on(t.at)]);

/** Versionierte Produktionsregeln (Learning Loop schreibt neue Versionen; alte bleiben reversibel). */
export const ruleVersions = pgTable("rule_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  version: integer("version").notNull(),
  rules: jsonb("rules").notNull(),
  rationale: text("rationale").notNull(),
  evidence: jsonb("evidence").notNull().default({}),
  active: boolean("active").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("rules_project_version_idx").on(t.projectId, t.version)]);

/** Kapazitäts-Fenster für Limit-aware Scheduling (persistiert). */
export const capacityWindows = pgTable("capacity_windows", {
  key: text("key").primaryKey(),
  maxPerWindow: integer("max_per_window").notNull(),
  windowSeconds: integer("window_seconds").notNull(),
  used: integer("used").notNull().default(0),
  windowStart: doublePrecision("window_start").notNull(),
  blockedUntil: doublePrecision("blocked_until"),
});
