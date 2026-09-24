/**
 * Zentrale Domänentypen des AI Content OS.
 * Persistenz-Details (Spalten) liegen in @content-os/db; hier nur fachliche Typen.
 */

export type ReviewMode = "SAFE" | "SEMI_AUTO" | "FULL_AUTO";
export type VideoFormat = "SHORT" | "LONGFORM";
export type Platform = "youtube" | "tiktok" | "instagram";
export type Language = "de" | "en" | (string & {});

/** Ehrliche Kennzeichnung jedes Workflow-Schritts. */
export type AutomationLevel = "AUTOMATED" | "SEMI_AUTOMATED" | "MANUAL" | "BLOCKED";

/** Pipeline-Stufen in fachlicher Reihenfolge. */
export const STAGES = [
  "IDEA",
  "SCORED",
  "SELECTED",
  "RESEARCH",
  "FACT_CHECK",
  "SCRIPT",
  "STORYBOARD",
  "ASSETS",
  "VOICE",
  "EDIT",
  "QA",
  "REVIEW",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "ANALYTICS",
  "ARCHIVED",
] as const;
export type Stage = (typeof STAGES)[number];

/** Ausführungszustand innerhalb einer Stufe. */
export type RunStatus =
  | "QUEUED"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "WAITING_FOR_CAPACITY"
  | "PAUSED"
  | "REJECTED"
  | "DEAD_LETTER";

export interface Project {
  id: string;
  slug: string;
  name: string;
  niche: string;
  language: Language;
  reviewMode: ReviewMode;
  /** Erlaubte Videos pro Tag (Scale-Gate) */
  maxVideosPerDay: number;
  /** Quality-Score-Schwelle für Auto-Freigabe (SEMI_AUTO / FULL_AUTO) */
  autoApproveThreshold: number;
  /** Mindest-Score, unter dem ein Video nie automatisch veröffentlicht wird */
  minPublishScore: number;
  styleGuide: StyleGuide;
  /** Versionierte Produktionsregeln (Learning Loop schreibt nur neue Versionen) */
  rulesVersion: number;
  active: boolean;
}

export interface StyleGuide {
  visualStyle: string; // z.B. "cinematic x-ray / cross-section, dark background, teal-orange accents"
  narrationTone: string; // z.B. "neugierig, präzise, keine Übertreibung"
  hookStyle: string; // z.B. "Frage-Hook + Konkretes Bild in Sekunde 1"
  voiceId?: string;
  voiceProvider?: string;
  fontFamily: string;
  brandColors: { primary: string; accent: string; background: string; text: string };
  captionStyle: "word" | "line" | "none";
  disclosureText: string; // Pflichthinweis für synthetische Inhalte
}

export interface Channel {
  id: string;
  projectId: string;
  platform: Platform;
  name: string;
  externalChannelId?: string;
  /** Verschlüsselt gespeicherter OAuth-Refresh-Token (nie im Klartext) */
  credentialsRef?: string;
  defaultPrivacy: "private" | "unlisted" | "public";
  defaultPublishHourLocal: number;
  timezone: string;
  active: boolean;
}

export interface TopicScoreFactors {
  viralPotential: number; // 0..1
  curiosityGap: number;
  visualPotential: number;
  evergreenPotential: number;
  searchDemand: number;
  competition: number; // 1 = wenig Konkurrenz
  commercialValue: number; // erwarteter RPM
  novelty: number; // 1 = neu für unseren Kanal
  productionDifficulty: number; // 1 = einfach
  factualRisk: number; // 1 = geringes Risiko
}

export interface Topic {
  id: string;
  projectId: string;
  title: string; // "Was passiert, wenn ein Aufzugseil reißt?"
  angle: string; // konkreter Blickwinkel / Hook-Idee
  format: VideoFormat;
  language: Language;
  source: "manual" | "discovery" | "repurpose";
  factors?: TopicScoreFactors;
  score?: number;
  status: "NEW" | "SCORED" | "SELECTED" | "REJECTED" | "PRODUCED";
  originalityCheck?: OriginalityResult;
  tags: string[];
}

export interface Source {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  publishedAt?: string;
  sourceType: "primary" | "peer_reviewed" | "official" | "reference" | "news" | "other";
  reliability: number; // 0..1
  excerpt?: string;
}

export interface Claim {
  id: string;
  text: string;
  sourceIds: string[];
  confidence: number; // 0..1
  verified: boolean;
  verdict?: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED" | "UNCERTAIN";
  notes?: string;
}

export interface ResearchDoc {
  id: string;
  topicId: string;
  summary: string;
  keyFacts: string[];
  claims: Claim[];
  sources: Source[];
  openQuestions: string[];
  riskFlags: string[]; // z.B. "medizinische Aussage", "Sicherheitsrelevant"
  model: string;
}

export interface ScriptSection {
  id: string;
  kind: "HOOK" | "SETUP" | "EXPLANATION" | "PAYOFF" | "PATTERN_INTERRUPT" | "CTA" | "OUTRO";
  narration: string;
  claimIds: string[];
  targetSeconds: number;
  visualIntent: string; // grob, wird im Storyboard verfeinert
}

export interface Script {
  id: string;
  topicId: string;
  format: VideoFormat;
  language: Language;
  title: string;
  hookType: "QUESTION" | "STATEMENT" | "SHOCK_FACT" | "SCENARIO" | "COUNTDOWN";
  sections: ScriptSection[];
  fullNarration: string;
  estimatedSeconds: number;
  wordCount: number;
  model: string;
  version: number;
}

export type SceneGenerationMethod =
  | "IMAGE_KENBURNS" // Standbild + Zoom/Pan (günstig, Default)
  | "IMAGE_TO_VIDEO" // Hero-Sequenz: Bild → Videoclip
  | "TEXT_TO_VIDEO"
  | "INFOGRAPHIC" // programmatisch (SVG/HTML), Labels exakt
  | "TEXT_CARD" // programmatische Text-Karte
  | "REUSED_ASSET"; // aus Asset-Library

export interface Scene {
  id: string;
  scriptId: string;
  index: number;
  sectionId: string;
  durationSec: number;
  narration: string;
  visualDescription: string;
  generationPrompt: string;
  negativePrompt?: string;
  method: SceneGenerationMethod;
  camera: string; // z.B. "slow push-in", "orbit", "static macro"
  transitionIn: "cut" | "fade" | "dissolve" | "wipeleft" | "zoom";
  soundDesign: string; // z.B. "low rumble, metallic creak"
  overlay?: { text: string; position: "top" | "bottom" | "center"; style: "label" | "stat" | "title" };
  claimIds: string[];
  visualStyleTag: string; // z.B. "xray", "cross_section", "macro", "simulation", "cinematic"
  assetIds: string[];
  reuseCandidateAssetId?: string;
}

export interface Storyboard {
  id: string;
  scriptId: string;
  aspect: "16:9" | "9:16";
  scenes: Scene[];
  visualStyle: string;
  colorPalette: string[];
  model: string;
}

export type AssetKind = "image" | "video" | "audio_voice" | "audio_music" | "audio_sfx" | "subtitle" | "thumbnail" | "render" | "infographic";

export interface Asset {
  id: string;
  projectId: string;
  kind: AssetKind;
  storageKey: string; // Pfad im Object Storage
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
  sizeBytes?: number;
  provider: string;
  model?: string;
  prompt?: string;
  promptHash?: string;
  topicId?: string;
  sceneId?: string;
  videoId?: string;
  rights: { source: "generated" | "licensed_library" | "own" | "public_domain"; license?: string; attributionRequired: boolean; notes?: string };
  usedInVideoIds: string[];
  tags: string[];
  createdAt: string;
}

export interface ExperimentAttributes {
  topicId: string;
  hookType: Script["hookType"];
  titleVariant: string;
  thumbnailVariant?: string;
  scriptStyle: string;
  visualStyle: string;
  voiceId?: string;
  durationSec: number;
  publishedAt?: string;
  channelId?: string;
  language: Language;
  generationModels: Record<string, string>; // task -> model
  generationCostEur: number;
}

export interface QACheckResult {
  check: string; // "FACT" | "VISUAL" | "AUDIO" | "RIGHTS" | "POLICY" | "DUPLICATION" | "REPETITION" | "TECHNICAL" | ...
  passed: boolean;
  severity: "info" | "warn" | "error" | "critical";
  score?: number; // 0..1
  details: string;
  automation: AutomationLevel;
  evidence?: Record<string, unknown>;
}

export interface QualityScore {
  factAccuracy: number;
  visualQuality: number;
  audioQuality: number;
  originality: number;
  hookStrength: number;
  retentionPrediction: number;
  policySafety: number;
  technicalQuality: number;
  total: number; // gewichtet 0..1
}

export interface QAReport {
  id: string;
  videoId: string;
  checks: QACheckResult[];
  score: QualityScore;
  decision: "PASS" | "FIX" | "REGENERATE" | "REVIEW" | "REJECT";
  reasons: string[];
  createdAt: string;
}

export interface OriginalityResult {
  topicDuplicate: boolean;
  maxTitleSimilarity: number;
  maxHookSimilarity: number;
  maxScriptSimilarity: number;
  maxSceneStructureSimilarity: number;
  similarVideoIds: string[];
  passed: boolean;
  notes: string[];
}

export interface Metadata {
  titleCandidates: string[];
  selectedTitle: string;
  description: string;
  chapters: { startSec: number; title: string }[];
  tags: string[];
  sourcesText: string;
  syntheticDisclosure: boolean;
  madeForKids: false;
  categoryId?: string;
  defaultLanguage: Language;
}

export interface Video {
  id: string;
  projectId: string;
  channelId?: string;
  topicId: string;
  format: VideoFormat;
  language: Language;
  stage: Stage;
  status: RunStatus;
  stageAttempt: number;
  researchId?: string;
  scriptId?: string;
  storyboardId?: string;
  renderAssetId?: string;
  thumbnailAssetId?: string;
  qaReportId?: string;
  metadata?: Metadata;
  experiment?: ExperimentAttributes;
  qualityScore?: number;
  costEur: number;
  /** Grund für WAITING_FOR_CAPACITY / FAILED / REJECTED */
  statusReason?: string;
  resumeAfter?: string;
  externalVideoId?: string;
  scheduledFor?: string;
  publishedAt?: string;
  parentVideoId?: string; // Repurposing: Short aus Longform
  createdAt: string;
  updatedAt: string;
}

export interface CostEntry {
  id: string;
  projectId?: string;
  videoId?: string;
  stage?: Stage;
  provider: string;
  model: string;
  capability: Capability;
  units: number; // Tokens, Sekunden, Bilder, Zeichen ...
  unitType: "input_tokens" | "output_tokens" | "cached_input_tokens" | "images" | "video_seconds" | "characters" | "audio_seconds" | "requests" | "render_minutes";
  costUsd: number;
  costEur: number;
  /** true = durch bereits vorhandenes Kontingent gedeckt (z.B. Free Tier), keine Zusatzkosten */
  coveredByQuota: boolean;
  requestId?: string;
  createdAt: string;
}

export type Capability =
  | "llm.cheap"
  | "llm.standard"
  | "llm.premium"
  | "llm.factcheck"
  | "llm.vision"
  | "search.web"
  | "search.deep"
  | "image.generate"
  | "image.edit"
  | "video.generate"
  | "video.image_to_video"
  | "tts"
  | "stt.align"
  | "music"
  | "sfx"
  | "moderation"
  | "storage"
  | "publish.youtube"
  | "analytics.youtube";

export interface AnalyticsSnapshot {
  id: string;
  videoId: string;
  channelId: string;
  capturedAt: string;
  windowDays: number;
  impressions?: number;
  ctr?: number;
  views?: number;
  watchTimeMinutes?: number;
  averageViewDurationSec?: number;
  averagePercentageViewed?: number;
  subscribersGained?: number;
  likes?: number;
  shares?: number;
  comments?: number;
  estimatedRevenueUsd?: number;
  rpmUsd?: number;
  trafficSources?: Record<string, number>;
  geography?: Record<string, number>;
  retentionCurve?: { pct: number; ratio: number }[];
  shortsViewedVsSwiped?: number;
  raw?: Record<string, unknown>;
}
