import type OpenAI from "openai";
import type { LLMProvider, LLMRequest, LLMResponse, Source, UsageReport } from "@content-os/core";
import { newId } from "@content-os/core";
import { openaiClient, translateOpenAIError } from "./client.ts";

/**
 * OpenAI Responses API (Text/Reasoning/Vision/Web-Search/Structured Outputs).
 * Modelle: gpt-6-luna (cheap), gpt-6-sol (standard), gpt-6-astra (premium) – siehe Routing.
 */
export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai";
  constructor(private readonly apiKey?: string) {}

  async complete<T = unknown>(model: string, req: LLMRequest): Promise<LLMResponse<T>> {
    const client = openaiClient(this.apiKey);
    const content: OpenAI.Responses.ResponseInputContent[] = [{ type: "input_text", text: req.prompt }];
    for (const img of req.images ?? []) content.push({ type: "input_image", image_url: img, detail: "auto" });

    const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      instructions: req.system,
      input: [{ role: "user", content }],
      max_output_tokens: req.maxOutputTokens ?? 8000,
      metadata: req.metadata,
      store: false,
    };
    if (req.reasoningEffort) params.reasoning = { effort: req.reasoningEffort as OpenAI.ReasoningEffort };
    if (req.temperature !== undefined && !req.reasoningEffort) params.temperature = req.temperature;
    if (req.jsonSchema) params.text = { format: { type: "json_schema", name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: req.jsonSchema.strict ?? true } };
    if (req.webSearch) params.tools = [{ type: "web_search" } as OpenAI.Responses.Tool];

    let res: OpenAI.Responses.Response;
    try {
      res = await client.responses.create(params);
    } catch (err) {
      translateOpenAIError(err, `responses.create(${model})`);
    }

    const text = res.output_text ?? "";
    const citations: Source[] = [];
    let webSearchCalls = 0;
    for (const item of res.output ?? []) {
      if (item.type === "web_search_call") webSearchCalls++;
      if (item.type === "message") {
        for (const c of item.content) {
          if (c.type === "output_text") {
            for (const a of c.annotations ?? []) {
              if (a.type === "url_citation" && !citations.some((s) => s.url === a.url)) {
                citations.push({ id: newId("src"), url: a.url, title: a.title ?? a.url, sourceType: "other", reliability: 0.5 });
              }
            }
          }
        }
      }
    }
    const usage: UsageReport[] = [];
    const u = res.usage;
    if (u) {
      const cached = u.input_tokens_details?.cached_tokens ?? 0;
      usage.push({ provider: "openai", model, units: Math.max(0, u.input_tokens - cached), unitType: "input_tokens", requestId: res.id });
      if (cached) usage.push({ provider: "openai", model, units: cached, unitType: "cached_input_tokens", requestId: res.id });
      usage.push({ provider: "openai", model, units: u.output_tokens, unitType: "output_tokens", requestId: res.id });
    }
    if (webSearchCalls) usage.push({ provider: "openai", model: "web_search", units: webSearchCalls, unitType: "requests", requestId: res.id });

    let json: T | undefined;
    if (req.jsonSchema && text) {
      try { json = JSON.parse(text) as T; } catch { json = undefined; }
    }
    const refusal = (res.output ?? []).some((i) => i.type === "message" && i.content.some((c) => c.type === "refusal"));
    return { text, json, citations, model: res.model ?? model, usage, finishReason: refusal ? "refusal" : res.status === "incomplete" ? "length" : "stop" };
  }
}
