import type { Topic, TopicScoreFactors, VideoFormat } from "@content-os/core";
import { scoreTopic, shortTextSimilarity, ORIGINALITY_THRESHOLDS } from "@content-os/core";
import type { PipelineContext } from "../context.ts";
import { callLLM } from "../llm.ts";
import { TopicIdeasSchema, TopicScoreSchema } from "../schemas.ts";
import { topicDiscoverPrompt, topicScorePrompt, SYSTEM_BASE } from "../prompts.ts";

/** Manuelles Thema anlegen (Status NEW). */
export async function createTopic(ctx: PipelineContext, input: { projectId: string; title: string; angle?: string; format: VideoFormat; language?: string; tags?: string[] }): Promise<Topic> {
  const project = await ctx.store.projects.get(input.projectId);
  if (!project) throw new Error(`Projekt ${input.projectId} nicht gefunden`);
  const existing = await ctx.store.topics.listByProject(input.projectId);
  const maxSim = Math.max(0, ...existing.map((t) => shortTextSimilarity(t.title, input.title)));
  const topic = await ctx.store.topics.create({
    projectId: input.projectId, title: input.title, angle: input.angle ?? "", format: input.format, language: input.language ?? project.language, source: "manual", status: "NEW", tags: input.tags ?? [],
    originalityCheck: { topicDuplicate: maxSim >= ORIGINALITY_THRESHOLDS.title, maxTitleSimilarity: maxSim, maxHookSimilarity: 0, maxScriptSimilarity: 0, maxSceneStructureSimilarity: 0, similarVideoIds: [], passed: maxSim < ORIGINALITY_THRESHOLDS.title, notes: maxSim >= ORIGINALITY_THRESHOLDS.title ? ["Sehr ähnlicher Titel bereits vorhanden"] : [] },
  });
  await ctx.store.audit.log({ actor: "system", action: "topic.create", entityType: "topic", entityId: topic.id, details: { title: topic.title, maxSim } });
  return topic;
}

/** LLM-Bewertung -> Score (textbasiert, günstig). Keine Video-Generierung für schwache Ideen. */
export async function scoreTopicWithLLM(ctx: PipelineContext, topicId: string): Promise<Topic> {
  const topic = await ctx.store.topics.get(topicId);
  if (!topic) throw new Error(`Topic ${topicId} nicht gefunden`);
  const existing = (await ctx.store.topics.listByProject(topic.projectId)).filter((t) => t.id !== topicId).map((t) => t.title);
  const res = await callLLM(ctx, "topic.score", { system: SYSTEM_BASE, prompt: topicScorePrompt(topic.title, topic.angle, topic.format, existing), schema: TopicScoreSchema, maxOutputTokens: 1500 }, { projectId: topic.projectId, topicTitle: topic.title, format: topic.format });
  const { rationale, suggestedAngle, ...factors } = res.data;
  const score = scoreTopic(factors as TopicScoreFactors, topic.format);
  return ctx.store.topics.update(topicId, { factors: factors as TopicScoreFactors, score, status: "SCORED", angle: topic.angle || suggestedAngle, tags: [...topic.tags, `rationale:${rationale.slice(0, 120)}`] });
}

/** Themen-Discovery (LLM + Websuche). Legt Topics mit Status NEW an. */
export async function discoverTopics(ctx: PipelineContext, projectId: string, n = 10): Promise<Topic[]> {
  const project = await ctx.store.projects.get(projectId);
  if (!project) throw new Error("Projekt fehlt");
  const existing = (await ctx.store.topics.listByProject(projectId)).map((t) => t.title);
  const res = await callLLM(ctx, "topic.discover", { system: SYSTEM_BASE, prompt: topicDiscoverPrompt(project.niche, existing, n), schema: TopicIdeasSchema, maxOutputTokens: 4000 }, { projectId });
  const out: Topic[] = [];
  for (const idea of res.data.ideas) {
    const t = await createTopic(ctx, { projectId, title: idea.title, angle: idea.angle, format: idea.format, tags: [...idea.tags, "source:discovery"] });
    out.push(await ctx.store.topics.update(t.id, { source: "discovery" }));
  }
  return out;
}
