import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { imageToClip, placeholderImage, probe, synthSpeech } from "@content-os/render";
import type {
  AnalyticsProvider, ImageProvider, ImageRequest, ModerationProvider, PublishProvider, PublishRequest, STTProvider, TTSProvider, TTSRequest, VideoProvider, VideoRequest, WordTimestamp,
} from "@content-os/core";

/** Offline-Bildgenerator: SVG-Platzhalter mit Prompt-Text (kostenlos, deterministisch). */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  async generate(req: ImageRequest) {
    const image = await placeholderImage({ prompt: req.prompt, width: req.width, height: req.height, style: req.style, label: "MOCK IMAGE" });
    return { image, mimeType: "image/png", width: req.width, height: req.height, model: "mock-image", usage: [{ provider: "mock", model: "mock-image", units: 1, unitType: "images" as const }] };
  }
  async edit(req: ImageRequest & { referenceImages: Buffer[] }) {
    return this.generate({ ...req, prompt: `[edit] ${req.prompt}` });
  }
}

/** Offline-Videoclip: Platzhalterbild + Ken Burns via FFmpeg (ersetzt KI-Video im Test). */
export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";
  async generate(req: VideoRequest) {
    const dir = await mkdtemp(join(tmpdir(), "mockvid-"));
    try {
      const img = join(dir, "in.png");
      const buf = req.inputImage ?? (await placeholderImage({ prompt: req.prompt, width: req.width, height: req.height, label: "MOCK VIDEO" }));
      await (await import("node:fs/promises")).writeFile(img, buf);
      const out = join(dir, "out.mp4");
      await imageToClip({ imagePath: img, outPath: out, durationSec: req.durationSec, width: req.width, height: req.height });
      const video = await readFile(out);
      return { video, mimeType: "video/mp4" as const, durationSec: req.durationSec, width: req.width, height: req.height, model: "mock-video", usage: [{ provider: "mock", model: "mock-video", units: req.durationSec, unitType: "video_seconds" as const }] };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
}

/** Offline-"Sprache": rhythmische Töne pro Wort + exakte Wort-Zeitstempel (für Untertitel-Tests). */
export class MockTTSProvider implements TTSProvider {
  readonly name = "mock";
  async synthesize(req: TTSRequest) {
    const dir = await mkdtemp(join(tmpdir(), "mocktts-"));
    try {
      const out = join(dir, "voice.wav");
      const { durationSec, words } = await synthSpeech({ text: req.text, outPath: out, wordsPerSecond: 2.6 * (req.speed ?? 1) });
      const audio = await readFile(out);
      return { audio, mimeType: "audio/wav", durationSec, words, model: "mock-tts", usage: [{ provider: "mock", model: "mock-tts", units: req.text.length, unitType: "characters" as const }] };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
  async listVoices() { return [{ id: "mock-voice", name: "Mock Voice", languages: ["de", "en"] }]; }
}

/** Offline-Alignment: verteilt Wörter gleichmäßig über die Audiodauer. */
export class MockSTTProvider implements STTProvider {
  readonly name = "mock";
  async transcribe(audio: Buffer, opts: { language: string; mimeType: string; promptText?: string }) {
    const dir = await mkdtemp(join(tmpdir(), "mockstt-"));
    try {
      const p = join(dir, "a.wav");
      await (await import("node:fs/promises")).writeFile(p, audio);
      const info = await probe(p);
      const tokens = (opts.promptText ?? "").split(/\s+/).filter(Boolean);
      const per = tokens.length ? info.durationSec / tokens.length : 0;
      const words: WordTimestamp[] = tokens.map((w, i) => ({ word: w, startSec: Number((i * per).toFixed(3)), endSec: Number(((i + 1) * per).toFixed(3)) }));
      return { text: tokens.join(" "), words, durationSec: info.durationSec, model: "mock-stt", usage: [{ provider: "mock", model: "mock-stt", units: info.durationSec, unitType: "audio_seconds" as const }] };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
}

export class MockModerationProvider implements ModerationProvider {
  readonly name = "mock";
  async moderate(input: { text?: string; imageDataUrl?: string }) {
    const t = (input.text ?? "").toLowerCase();
    const flagged = /\b(gore|explicit|hate)\b/.test(t);
    return { flagged, categories: { violence: flagged ? 0.9 : 0.01 }, usage: [{ provider: "mock", model: "mock-moderation", units: 1, unitType: "requests" as const }] };
  }
}

/** Simulierter Upload: schreibt Quittung, liefert Fake-ID. NIEMALS als echter Upload ausgeben. */
export class MockPublishProvider implements PublishProvider {
  readonly name = "mock";
  readonly platform = "youtube" as const;
  uploads: PublishRequest[] = [];
  async upload(req: PublishRequest) {
    this.uploads.push(req);
    const id = `mock_${Math.random().toString(36).slice(2, 13)}`;
    return { externalVideoId: id, url: `https://example.invalid/watch?v=${id}`, status: req.publishAt ? "scheduled(mock)" : `${req.privacy}(mock)`, usage: [{ provider: "mock", model: "mock-youtube", units: 1, unitType: "requests" as const }], warnings: ["MOCK: kein echter Upload durchgeführt"] };
  }
  async setThumbnail() { /* no-op */ }
}

export class MockAnalyticsProvider implements AnalyticsProvider {
  readonly name = "mock";
  async fetchVideoStats() {
    return { rows: [{ views: 0, estimatedMinutesWatched: 0, averageViewDuration: 0, averageViewPercentage: 0, subscribersGained: 0, mock: true }], usage: [{ provider: "mock", model: "mock-analytics", units: 1, unitType: "requests" as const }] };
  }
  async fetchRetention() { return { curve: [], usage: [] }; }
}
