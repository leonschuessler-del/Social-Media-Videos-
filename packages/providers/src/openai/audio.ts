import { toFile } from "openai";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ModerationProvider, STTProvider, STTResult, TTSProvider, TTSRequest, TTSResult, WordTimestamp } from "@content-os/core";
import { probe, runFfmpeg } from "@content-os/render";
import { openaiClient, translateOpenAIError } from "./client.ts";

const MAX_CHARS = 4000; // API-Limit 4096 Zeichen pro Request

export function chunkText(text: string, max = MAX_CHARS): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > max && cur) { chunks.push(cur.trim()); cur = s; } else cur = (cur + " " + s).trim();
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/**
 * OpenAI TTS (gpt-4o-mini-tts): steuerbar per `instructions`, 13 Stimmen, Deutsch unterstützt.
 * Liefert KEINE Wort-Zeitstempel -> Alignment über OpenAISTTProvider (whisper-1).
 */
export class OpenAITTSProvider implements TTSProvider {
  readonly name = "openai";
  constructor(private readonly opts: { model?: string; apiKey?: string } = {}) {}
  get model() { return this.opts.model ?? process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts"; }

  async synthesize(req: TTSRequest): Promise<TTSResult> {
    const client = openaiClient(this.opts.apiKey);
    const chunks = chunkText(req.text);
    const dir = await mkdtemp(join(tmpdir(), "oatts-"));
    try {
      const parts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        let buf: Buffer;
        try {
          const res = await client.audio.speech.create({ model: this.model, voice: req.voiceId as "alloy", input: chunks[i]!, instructions: req.instructions, response_format: "mp3", speed: req.speed ?? 1 });
          buf = Buffer.from(await res.arrayBuffer());
        } catch (err) { translateOpenAIError(err, `audio.speech.create(${this.model})`); }
        const p = join(dir, `part_${i}.mp3`);
        await writeFile(p, buf);
        parts.push(p);
      }
      const out = join(dir, "voice.mp3");
      if (parts.length === 1) await writeFile(out, await readFile(parts[0]!));
      else {
        const list = join(dir, "list.txt");
        await writeFile(list, parts.map((p) => `file '${p}'`).join("\n"));
        await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
      }
      const info = await probe(out);
      const audio = await readFile(out);
      return {
        audio, mimeType: "audio/mpeg", durationSec: info.durationSec, model: this.model,
        usage: [
          { provider: "openai", model: this.model, units: req.text.length, unitType: "characters" },
          { provider: "openai", model: this.model, units: info.durationSec, unitType: "audio_seconds" },
        ],
      };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  async listVoices() {
    return ["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"].map((id) => ({ id, name: id, languages: ["de", "en", "multi"] }));
  }
}

/** whisper-1 mit Wort-Zeitstempeln (einziges OpenAI-STT mit timestamp_granularities=word, Stand 2026-09). */
export class OpenAISTTProvider implements STTProvider {
  readonly name = "openai";
  constructor(private readonly opts: { model?: string; apiKey?: string } = {}) {}
  get model() { return this.opts.model ?? "whisper-1"; }
  async transcribe(audio: Buffer, opts: { language: string; mimeType: string; promptText?: string }): Promise<STTResult> {
    const client = openaiClient(this.opts.apiKey);
    const ext = opts.mimeType.includes("wav") ? "wav" : "mp3";
    try {
      const res = await client.audio.transcriptions.create({
        file: await toFile(audio, `voice.${ext}`, { type: opts.mimeType }),
        model: this.model, language: opts.language, response_format: "verbose_json", timestamp_granularities: ["word"],
        prompt: opts.promptText?.slice(0, 800),
      });
      const words: WordTimestamp[] = (res.words ?? []).map((w) => ({ word: w.word, startSec: w.start, endSec: w.end }));
      const durationSec = Number(res.duration ?? (words.at(-1)?.endSec ?? 0));
      return { text: res.text, words, durationSec, model: this.model, usage: [{ provider: "openai", model: this.model, units: durationSec, unitType: "audio_seconds" }] };
    } catch (err) { translateOpenAIError(err, `audio.transcriptions.create(${this.model})`); }
  }
}

/** omni-moderation-latest: kostenlos, Text + Bild. */
export class OpenAIModerationProvider implements ModerationProvider {
  readonly name = "openai";
  constructor(private readonly apiKey?: string) {}
  async moderate(input: { text?: string; imageDataUrl?: string }) {
    const client = openaiClient(this.apiKey);
    const parts: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] = [];
    if (input.text) parts.push({ type: "text", text: input.text.slice(0, 30_000) });
    if (input.imageDataUrl) parts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
    try {
      const res = await client.moderations.create({ model: "omni-moderation-latest", input: parts });
      const r = res.results[0]!;
      return { flagged: r.flagged, categories: r.category_scores as unknown as Record<string, number>, usage: [{ provider: "openai", model: "omni-moderation-latest", units: 1, unitType: "requests" as const }] };
    } catch (err) { translateOpenAIError(err, "moderations.create"); }
  }
}
