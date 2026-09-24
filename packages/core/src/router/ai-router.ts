import type { Capability } from "../domain.ts";

/**
 * Task-basiertes Modell-Routing. OpenAI-first: alle Defaults zeigen auf OpenAI.
 * Alternativen sind hinterlegt, aber nur nutzbar, wenn der Provider in ENABLED_PROVIDERS steht.
 * Änderungen sind versioniert (git) – kein selbstmodifizierendes Routing.
 */
export type TaskKind =
  | "topic.discover" | "topic.score" | "research.query" | "research.synthesize" | "factcheck.verify"
  | "script.write" | "script.polish" | "storyboard.build" | "prompt.generate" | "qa.script" | "qa.visual"
  | "metadata.generate" | "thumbnail.concept" | "learning.analyze" | "originality.judge";

export interface RouteTarget { provider: string; model: string; capability: Capability; reasoningEffort?: "minimal" | "low" | "medium" | "high"; webSearch?: boolean }

export interface RoutingTable { version: number; routes: Record<TaskKind, RouteTarget[]> }

/** Präferenzliste je Task: erstes freigegebenes Ziel gewinnt. */
export const ROUTING_V1: RoutingTable = {
  version: 1,
  routes: {
    "topic.discover":      [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low", webSearch: true }],
    "topic.score":         [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low" }],
    "research.query":      [{ provider: "openai", model: "gpt-6-luna", capability: "search.web", reasoningEffort: "low", webSearch: true }],
    "research.synthesize": [{ provider: "openai", model: "gpt-6-sol", capability: "llm.standard", reasoningEffort: "medium", webSearch: true }],
    // Fact-Check: anderes Modell/Effort als Research, damit nicht dieselbe "Meinung" zweimal bestätigt wird
    "factcheck.verify":    [{ provider: "openai", model: "gpt-6-sol", capability: "llm.factcheck", reasoningEffort: "high", webSearch: true },
                            { provider: "anthropic", model: "claude-sonnet-5", capability: "llm.factcheck" }],
    "script.write":        [{ provider: "openai", model: "gpt-6-sol", capability: "llm.premium", reasoningEffort: "medium" }],
    "script.polish":       [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low" }],
    "storyboard.build":    [{ provider: "openai", model: "gpt-6-sol", capability: "llm.standard", reasoningEffort: "medium" }],
    "prompt.generate":     [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "minimal" }],
    "qa.script":           [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low" }],
    "qa.visual":           [{ provider: "openai", model: "gpt-6-luna", capability: "llm.vision", reasoningEffort: "low" }],
    "metadata.generate":   [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low" }],
    "thumbnail.concept":   [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "low" }],
    "learning.analyze":    [{ provider: "openai", model: "gpt-6-sol", capability: "llm.standard", reasoningEffort: "medium" }],
    "originality.judge":   [{ provider: "openai", model: "gpt-6-luna", capability: "llm.cheap", reasoningEffort: "minimal" }],
  },
};

export class AIRouter {
  constructor(private readonly table: RoutingTable, private readonly enabled: Set<string>, private readonly mode: "mock" | "live") {}

  resolve(task: TaskKind): RouteTarget {
    if (this.mode === "mock") {
      const first = this.table.routes[task][0]!;
      return { ...first, provider: "mock", model: `mock-${first.model}` };
    }
    for (const t of this.table.routes[task]) {
      if (this.enabled.has(t.provider)) return t;
    }
    const first = this.table.routes[task][0]!;
    throw new Error(`Kein freigegebener Provider für Task ${task} (Default: ${first.provider}). ENABLED_PROVIDERS prüfen.`);
  }

  get version() { return this.table.version; }
}
