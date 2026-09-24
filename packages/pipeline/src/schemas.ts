import { z } from "zod";

export const TopicScoreSchema = z.object({
  viralPotential: z.number(), curiosityGap: z.number(), visualPotential: z.number(), evergreenPotential: z.number(),
  searchDemand: z.number(), competition: z.number(), commercialValue: z.number(), novelty: z.number(),
  productionDifficulty: z.number(), factualRisk: z.number(),
  rationale: z.string(),
  suggestedAngle: z.string(),
});

export const TopicIdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), angle: z.string(), format: z.enum(["SHORT", "LONGFORM"]), whyNow: z.string(), tags: z.array(z.string()) })),
});

export const ResearchSchema = z.object({
  summary: z.string(),
  keyFacts: z.array(z.string()),
  claims: z.array(z.object({
    text: z.string(),
    sourceUrls: z.array(z.string()),
    confidence: z.number(),
    category: z.enum(["physics", "engineering", "history", "biology", "medicine", "statistics", "other"]),
  })),
  sources: z.array(z.object({ url: z.string(), title: z.string(), publisher: z.string(), sourceType: z.enum(["primary", "peer_reviewed", "official", "reference", "news", "other"]), reliability: z.number() })),
  openQuestions: z.array(z.string()),
  riskFlags: z.array(z.string()),
});

export const FactCheckSchema = z.object({
  verdicts: z.array(z.object({ claimIndex: z.number(), verdict: z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "UNCERTAIN"]), confidence: z.number(), notes: z.string(), correction: z.string() })),
  overallRisk: z.enum(["low", "medium", "high"]),
  mustFix: z.array(z.string()),
});

export const ScriptSchema = z.object({
  title: z.string(),
  hookType: z.enum(["QUESTION", "STATEMENT", "SHOCK_FACT", "SCENARIO", "COUNTDOWN"]),
  sections: z.array(z.object({
    kind: z.enum(["HOOK", "SETUP", "EXPLANATION", "PAYOFF", "PATTERN_INTERRUPT", "CTA", "OUTRO"]),
    narration: z.string(),
    claimIndexes: z.array(z.number()),
    targetSeconds: z.number(),
    visualIntent: z.string(),
  })),
  styleNotes: z.string(),
});

export const StoryboardSchema = z.object({
  visualStyle: z.string(),
  colorPalette: z.array(z.string()),
  scenes: z.array(z.object({
    sectionIndex: z.number(),
    narration: z.string(),
    visualDescription: z.string(),
    generationPrompt: z.string(),
    negativePrompt: z.string(),
    method: z.enum(["IMAGE_KENBURNS", "IMAGE_TO_VIDEO", "TEXT_TO_VIDEO", "INFOGRAPHIC", "TEXT_CARD", "REUSED_ASSET"]),
    camera: z.enum(["push_in", "pull_out", "pan_left", "pan_right", "static"]),
    transitionIn: z.enum(["cut", "fade", "dissolve", "wipeleft", "zoom"]),
    soundDesign: z.string(),
    overlayText: z.string(),
    overlayStyle: z.enum(["none", "label", "stat", "title"]),
    visualStyleTag: z.string(),
    infographic: z.object({ title: z.string(), value: z.string(), label: z.string() }).nullable(),
  })),
});

export const MetadataSchema = z.object({
  titleCandidates: z.array(z.string()),
  selectedTitleIndex: z.number(),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailHeadline: z.string(),
  thumbnailVariant: z.enum(["left_text", "bottom_band", "center_burst"]),
});

export const ScriptQaSchema = z.object({
  factIssues: z.array(z.object({ excerpt: z.string(), problem: z.string(), severity: z.enum(["warn", "error", "critical"]) })),
  hookStrength: z.number(),
  retentionPrediction: z.number(),
  clarity: z.number(),
  policyConcerns: z.array(z.string()),
  notes: z.string(),
});

export const VisualQaSchema = z.object({
  frames: z.array(z.object({ frameIndex: z.number(), quality: z.number(), artifacts: z.array(z.string()), matchesIntent: z.boolean(), textLegible: z.boolean(), notes: z.string() })),
  overallVisualQuality: z.number(),
  criticalProblems: z.array(z.string()),
});

export type TopicScoreOut = z.infer<typeof TopicScoreSchema>;
export type ResearchOut = z.infer<typeof ResearchSchema>;
export type FactCheckOut = z.infer<typeof FactCheckSchema>;
export type ScriptOut = z.infer<typeof ScriptSchema>;
export type StoryboardOut = z.infer<typeof StoryboardSchema>;
export type MetadataOut = z.infer<typeof MetadataSchema>;
export type ScriptQaOut = z.infer<typeof ScriptQaSchema>;
export type VisualQaOut = z.infer<typeof VisualQaSchema>;
export type TopicIdeasOut = z.infer<typeof TopicIdeasSchema>;
