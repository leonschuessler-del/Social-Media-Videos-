import { readdir, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { probe, synthMusic } from "@content-os/render";
import type { MusicProvider, MusicTrack, SfxClip, SfxProvider } from "@content-os/core";

interface LicenseFile { tracks?: Record<string, { title?: string; mood?: string[]; tags?: string[]; license: string; attributionRequired?: boolean; source?: string; bpm?: number }> }

async function readLicense(dir: string): Promise<LicenseFile> {
  try { return JSON.parse(await readFile(join(dir, "license.json"), "utf8")) as LicenseFile; } catch { return {}; }
}

/**
 * Musik aus lokaler, lizenzierter Bibliothek (license.json Pflicht je Datei).
 * Fallback: synthetisches Ambient-Pad (eigene Erzeugung => keine Rechteprobleme, aber hörbar simpel).
 * OpenAI bietet keine Musik-API (Stand 2026-09) -> Status: BLOCKED_BY_PROVIDER für generative Musik.
 */
export class LibraryMusicProvider implements MusicProvider {
  readonly name = "local";
  constructor(private readonly dir: string, private readonly fallbackDir: string) {}

  async pick(opts: { mood: string; durationSec: number; exclude?: string[] }) {
    const lic = await readLicense(this.dir);
    let files: string[] = [];
    try { files = (await readdir(this.dir)).filter((f) => /\.(mp3|wav|m4a|flac|ogg)$/i.test(f)); } catch { files = []; }
    const candidates = files.filter((f) => lic.tracks?.[f]).filter((f) => !opts.exclude?.includes(f));
    const scored = candidates.map((f) => ({ f, s: (lic.tracks![f]!.mood ?? []).includes(opts.mood) ? 2 : 1 })).sort((a, b) => b.s - a.s);
    const chosen = scored[0]?.f;
    if (chosen) {
      const meta = lic.tracks![chosen]!;
      const p = join(this.dir, chosen);
      const info = await probe(p);
      const track: MusicTrack = { id: chosen, path: p, title: meta.title ?? chosen, mood: meta.mood ?? [], bpm: meta.bpm, durationSec: info.durationSec, license: meta.license, attributionRequired: meta.attributionRequired ?? false, source: meta.source ?? "library" };
      return { track, usage: [{ provider: "local", model: "library", units: 1, unitType: "requests" as const }] };
    }
    await mkdir(this.fallbackDir, { recursive: true });
    const out = join(this.fallbackDir, `synth_pad_${opts.mood.replace(/\W+/g, "_")}_${Math.round(opts.durationSec)}.wav`);
    await synthMusic({ outPath: out, durationSec: Math.ceil(opts.durationSec) + 2, seed: opts.mood.length });
    const track: MusicTrack = { id: `synth:${opts.mood}`, path: out, title: "Synthetic ambient pad (fallback)", mood: [opts.mood], durationSec: opts.durationSec + 2, license: "own-generated", attributionRequired: false, source: "synth-fallback" };
    return { track, usage: [{ provider: "local", model: "ffmpeg", units: 0, unitType: "render_minutes" as const }] };
  }
}

/** SFX aus lokaler Bibliothek (license.json). Kein Fallback: fehlende SFX werden weggelassen (kein Fake). */
export class LibrarySfxProvider implements SfxProvider {
  readonly name = "local";
  constructor(private readonly dir: string) {}
  async find(opts: { description: string; maxDurationSec?: number }) {
    const lic = await readLicense(this.dir);
    let files: string[] = [];
    try { files = (await readdir(this.dir)).filter((f) => /\.(mp3|wav|ogg|flac)$/i.test(f)); } catch { files = []; }
    const words = opts.description.toLowerCase().split(/\W+/).filter(Boolean);
    let best: { f: string; s: number } | undefined;
    for (const f of files) {
      const meta = lic.tracks?.[f];
      if (!meta) continue;
      const tags = (meta.tags ?? []).map((t) => t.toLowerCase());
      const s = words.filter((w) => tags.includes(w) || f.toLowerCase().includes(w)).length;
      if (s > 0 && (!best || s > best.s)) best = { f, s };
    }
    if (!best) return { clip: undefined, usage: [] };
    const meta = lic.tracks![best.f]!;
    const p = join(this.dir, best.f);
    const info = await probe(p);
    const clip: SfxClip = { id: best.f, path: p, tags: meta.tags ?? [], durationSec: info.durationSec, license: meta.license, attributionRequired: meta.attributionRequired ?? false, source: meta.source ?? "library" };
    return { clip, usage: [{ provider: "local", model: "library", units: 1, unitType: "requests" as const }] };
  }
}
