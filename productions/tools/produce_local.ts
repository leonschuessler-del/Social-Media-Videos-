/**
 * Vollständige, wiederaufnehmbare lokale Video-Produktion aus einem vorhandenen Produktionsordner.
 * Nutzt ausschließlich die lokale Motion-Graphics-Pipeline (tts_build.py, audio_synth.py, build_video.ts).
 * Ruft NIEMALS den bild-/OpenAI-basierten Pfad auf (packages/pipeline, apps/cli "pnpm cli produce").
 *
 * Aufruf (normalerweise über produce.sh, siehe dort):
 *   PY=<venv-python> TTS_MODEL=<modell-ordner> npx tsx productions/tools/produce_local.ts <productionDir> \
 *     [--force] [--from-step STEP] [--to-step STEP] [--dry-run] \
 *     [--length-scale 0.9] [--preset medium] [--chunks 4] [--crf 18] [--min-duration 540] [--max-duration 780]
 *
 * Schritte: validate -> voice -> timeline -> audio -> render -> mux (inkl. Metadaten) -> qa
 * Jeder Schritt speichert einen Zustand (Eingabe-Hash + Parameter) in out/.state/<schritt>.json.
 * Bei unveränderten Eingaben und vorhandenen Ausgaben wird ein Schritt übersprungen (Wiederaufnahme nach
 * Unterbrechung). Ändert sich eine Eingabedatei (z.B. lexicon.json), werden dieser Schritt und alle
 * nachfolgenden automatisch neu ausgeführt, weil deren Eingaben (z.B. timings.json) sich dadurch mitändern.
 *
 * Kein automatischer Rückgriff auf kostenpflichtige Dienste, keine Wiederholungsschleifen bei Fehlern:
 * ein fehlgeschlagener Schritt bricht die gesamte Produktion sofort ab (Exit-Code ungleich 0).
 */
import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, relative } from "node:path";
import { execa } from "execa";

const REPO = resolve(import.meta.dirname, "../..");
const TOOLS = resolve(import.meta.dirname);

function arg(k: string, d?: string): string | undefined {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d;
}
function flag(k: string): boolean {
  return process.argv.includes(`--${k}`);
}

const dirArgRaw = process.argv[2];
if (!dirArgRaw || dirArgRaw.startsWith("--")) {
  console.error("Fehler: Produktionsordner fehlt.\nAufruf: produce.sh <productionDir> [--force] [--from-step S] [--to-step S] ...");
  process.exit(2);
}
const dir = resolve(dirArgRaw);
const out = join(dir, "out");
const stateDir = join(out, ".state");
const logFile = join(out, "produce.log");
const PY = process.env.PY;
const TTS_MODEL = process.env.TTS_MODEL;
const FF = process.env.FFMPEG_PATH ?? "ffmpeg";
const FORCE = flag("force");
const DRY = flag("dry-run");
const FROM_STEP = arg("from-step");
const TO_STEP = arg("to-step");
const LENGTH_SCALE = arg("length-scale", "1.0")!;
const PRESET = arg("preset", "medium")!;
const CHUNKS = arg("chunks", "3")!;
const CRF = arg("crf", "18")!;
const MIN_DUR = arg("min-duration", "540")!;
const MAX_DUR = arg("max-duration", "780")!;

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

// Saubere Unterbrechung: Strg+C, "kill <pid>" (ohne -9) oder "docker stop" senden SIGINT/SIGTERM an diesen
// Prozess. build_video.ts/tts_build.py spawnen ihrerseits weitere Kindprozesse (ffmpeg, Chromium) - das sind
// also Enkel/Urenkel dieses Skripts, keine direkten Kinder, und npx/node setzen dafür keine gemeinsame,
// eindeutig adressierbare Prozessgruppe. Deshalb wird der komplette Prozess-Baum über /proc (ps) aufgelöst und
// gezielt beendet, statt sich auf Prozessgruppen zu verlassen.
// Ein "kill -9" ausschließlich gegen die produce_local.ts-PID lässt sich grundsätzlich NICHT abfangen (SIGKILL
// ist nicht behandelbar) und kann verwaiste ffmpeg-/Chromium-Prozesse hinterlassen - siehe README, Abschnitt
// "Unterbrechen und fortsetzen", für den manuellen Aufräumbefehl in diesem Fall.
let currentChildPid: number | undefined;

async function descendantPids(rootPid: number): Promise<number[]> {
  const { stdout } = await execa("ps", ["-eo", "pid,ppid", "--no-headers"]);
  const childrenOf = new Map<number, number[]>();
  for (const line of stdout.trim().split("\n")) {
    const [pidS, ppidS] = line.trim().split(/\s+/);
    const pid = Number(pidS), ppid = Number(ppidS);
    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue;
    childrenOf.set(ppid, [...(childrenOf.get(ppid) ?? []), pid]);
  }
  const out: number[] = [];
  const queue = [rootPid];
  while (queue.length) {
    const p = queue.shift()!;
    for (const c of childrenOf.get(p) ?? []) { out.push(c); queue.push(c); }
  }
  return out;
}

async function killTree(rootPid: number, signal: NodeJS.Signals): Promise<void> {
  let pids: number[] = [];
  try { pids = await descendantPids(rootPid); } catch { /* ps nicht verfügbar - nur den bekannten Prozess selbst */ }
  for (const pid of [...pids, rootPid]) { try { process.kill(pid, signal); } catch { /* schon beendet */ } }
}

let shuttingDown = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void (async () => {
      await log(`Unterbrechung (${sig}) empfangen - beende laufende Unterprozesse (ffmpeg/Chromium) …`);
      if (currentChildPid) {
        await killTree(currentChildPid, "SIGTERM");
        await new Promise((r) => setTimeout(r, 2500));
        await killTree(currentChildPid, "SIGKILL");
      }
      process.exit(sig === "SIGINT" ? 130 : 143);
    })();
  });
}

async function log(line: string): Promise<void> {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  await mkdir(out, { recursive: true });
  await writeFile(logFile, stamped + "\n", { flag: "a" });
}

/** SHA-256 über eine oder mehrere Dateien (gestreamt, auch für große .mp4/.wav geeignet), plus optionale Parameter. */
async function hashInputs(files: string[], params: Record<string, unknown> = {}): Promise<string> {
  const h = createHash("sha256");
  for (const f of [...files].sort()) {
    if (!(await exists(f))) { h.update(`MISSING:${relative(REPO, f)}\n`); continue; }
    h.update(`FILE:${relative(REPO, f)}\n`);
    await new Promise<void>((res, rej) => {
      const s = createReadStream(f);
      s.on("data", (c) => h.update(c));
      s.on("end", () => res());
      s.on("error", rej);
    });
  }
  h.update(`PARAMS:${JSON.stringify(params, Object.keys(params).sort())}`);
  return h.digest("hex");
}

interface StepState { inputHash: string; params: Record<string, unknown>; status: "ok" | "error"; completedAt: string; durationMs: number; error?: string }

async function readState(step: string): Promise<StepState | null> {
  const f = join(stateDir, `${step}.json`);
  if (!(await exists(f))) return null;
  try { return JSON.parse(await readFile(f, "utf8")) as StepState; } catch { return null; }
}
async function writeState(step: string, s: StepState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, `${step}.json`), JSON.stringify(s, null, 1));
}

interface Step {
  name: string;
  inputFiles: () => Promise<string[]>;
  params: () => Record<string, unknown>;
  outputFiles: () => string[];
  run: () => Promise<void>;
}

async function glob(dirPath: string, suffix: string): Promise<string[]> {
  if (!(await exists(dirPath))) return [];
  const entries = await readdir(dirPath);
  return entries.filter((e) => e.endsWith(suffix)).map((e) => join(dirPath, e)).sort();
}

async function pickStoryboard(): Promise<string> {
  return (await exists(join(dir, "storyboard_final.json"))) ? join(dir, "storyboard_final.json") : join(dir, "storyboard.json");
}

async function runBuildVideo(stage: string, extra: string[] = []): Promise<void> {
  if (!PY) throw new Error("Umgebungsvariable PY ist nicht gesetzt (Pfad zum venv-Python der TTS-Umgebung).");
  const child = execa("npx", ["tsx", join(TOOLS, "build_video.ts"), dir, "--stage", stage, ...extra], {
    stdio: "inherit", cwd: REPO, env: { ...process.env, PY, FFMPEG_PATH: FF },
  });
  currentChildPid = child.pid;
  try { await child; } finally { currentChildPid = undefined; }
}

// ---------------------------------------------------------------- Schritt: validate
async function stepValidate(): Promise<void> {
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!(await exists(join(dir, "script.json")))) problems.push("script.json fehlt");
  const sbPath = await pickStoryboard();
  if (!(await exists(sbPath))) problems.push(`Storyboard fehlt (storyboard_final.json oder storyboard.json in ${dir})`);
  if (!(await exists(join(dir, "factbase.json")))) warnings.push("factbase.json fehlt – Beschreibung wird ohne Quellenliste erzeugt");

  let script: { segments?: { id: string; narration_tts?: string }[]; title_candidates?: string[] } | null = null;
  let storyboard: { scenes?: { id: string; segment_id: string; template: string; params_json: string }[] } | null = null;

  if (problems.length === 0) {
    try { script = JSON.parse(await readFile(join(dir, "script.json"), "utf8")); }
    catch (e) { problems.push(`script.json ist kein gültiges JSON: ${(e as Error).message}`); }
    try { storyboard = JSON.parse(await readFile(sbPath, "utf8")); }
    catch (e) { problems.push(`Storyboard ist kein gültiges JSON: ${(e as Error).message}`); }
  }
  if (script) {
    if (!Array.isArray(script.segments) || script.segments.length === 0) problems.push("script.json: 'segments' fehlt oder ist leer");
    else for (const s of script.segments) if (!s.id || !s.narration_tts) problems.push(`script.json: Segment ohne 'id' oder 'narration_tts': ${JSON.stringify(s).slice(0, 80)}`);
    if (!Array.isArray(script.title_candidates) || script.title_candidates.length === 0) warnings.push("script.json: 'title_candidates' fehlt oder ist leer – Metadaten-Titel könnte leer bleiben");
  }
  if (storyboard) {
    if (!Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) problems.push("Storyboard: 'scenes' fehlt oder ist leer");
    else {
      const templatesDir = join(REPO, "packages/motion/web/templates");
      const known = new Set((await readdir(templatesDir)).map((f) => f.replace(/\.js$/, "")));
      const segIds = new Set((script?.segments ?? []).map((s) => s.id));
      for (const sc of storyboard.scenes) {
        if (!known.has(sc.template)) problems.push(`Szene ${sc.id}: unbekannte Vorlage '${sc.template}' (nicht in packages/motion/web/templates/)`);
        if (script && !segIds.has(sc.segment_id)) problems.push(`Szene ${sc.id}: segment_id '${sc.segment_id}' kommt in script.json nicht vor`);
        try { JSON.parse(sc.params_json || "{}"); } catch { problems.push(`Szene ${sc.id}: params_json ist kein gültiges JSON`); }
      }
    }
  }
  if (await exists(join(dir, "lexicon.json"))) {
    try { JSON.parse(await readFile(join(dir, "lexicon.json"), "utf8")); } catch (e) { problems.push(`lexicon.json ist kein gültiges JSON: ${(e as Error).message}`); }
  }

  // externe Werkzeuge
  if (!PY) problems.push("Umgebungsvariable PY fehlt (Pfad zum venv-Python, siehe productions/tools/README.md)");
  else if (!(await exists(PY))) problems.push(`PY zeigt auf einen nicht vorhandenen Pfad: ${PY}`);
  if (!TTS_MODEL) problems.push("Umgebungsvariable TTS_MODEL fehlt (Ordner mit model_file.pth/config.json)");
  else {
    if (!(await exists(join(TTS_MODEL, "model_file.pth")))) problems.push(`TTS_MODEL/model_file.pth fehlt in ${TTS_MODEL}`);
    if (!(await exists(join(TTS_MODEL, "config.json")))) problems.push(`TTS_MODEL/config.json fehlt in ${TTS_MODEL}`);
  }
  try { await execa(FF, ["-version"]); } catch { problems.push(`ffmpeg nicht ausführbar (FFMPEG_PATH=${FF})`); }
  try { await execa("npx", ["tsx", "--version"], { cwd: REPO }); } catch { problems.push("npx tsx nicht ausführbar"); }

  // Aussprache-Hinweis (rein informativ, blockiert nichts)
  if (PY && script) {
    try {
      const { stdout } = await execa(PY, [join(TOOLS, "pronounce_check.py"), join(dir, "script.json")]);
      const rep = JSON.parse(stdout) as { unique_words: number; flagged: Record<string, unknown> };
      const n = Object.keys(rep.flagged).length;
      if (n > 0) warnings.push(`Aussprache: ${n} von ${rep.unique_words} Wörtern unsicher (siehe lexicon.json pflegen, productions/tools/pronounce_check.py)`);
    } catch { warnings.push("Aussprache-Prüfung (pronounce_check.py) konnte nicht laufen – übersprungen, blockiert die Produktion nicht"); }
  }

  for (const w of warnings) await log(`WARNUNG (validate): ${w}`);
  if (problems.length) {
    for (const p of problems) await log(`FEHLER (validate): ${p}`);
    throw new Error(`Eingabeprüfung fehlgeschlagen: ${problems.length} Problem(e), siehe Log oben.`);
  }
  await log(`validate: OK (${warnings.length} Warnung(en))`);
}

// ---------------------------------------------------------------- Schrittliste
const steps: Step[] = [
  {
    name: "voice",
    inputFiles: async () => [join(dir, "script.json"), join(dir, "lexicon.json")],
    params: () => ({ model: TTS_MODEL, lengthScale: LENGTH_SCALE }),
    outputFiles: () => [join(out, "voice/voice.wav"), join(out, "voice/timings.json")],
    run: async () => {
      if (!PY) throw new Error("PY nicht gesetzt");
      if (!TTS_MODEL) throw new Error("TTS_MODEL nicht gesetzt");
      const args = [join(TOOLS, "tts_build.py"), join(dir, "script.json"), join(out, "voice"), "--model", TTS_MODEL, "--length-scale", LENGTH_SCALE];
      if (await exists(join(dir, "lexicon.json"))) args.push("--lexicon", join(dir, "lexicon.json"));
      const child = execa(PY, args, { stdio: "inherit", cwd: REPO });
      currentChildPid = child.pid;
      try { await child; } finally { currentChildPid = undefined; }
    },
  },
  {
    name: "timeline",
    inputFiles: async () => [await pickStoryboard(), join(out, "voice/timings.json")],
    params: () => ({}),
    outputFiles: () => [join(out, "timeline.json"), join(out, "captions.ass"), join(out, "captions.srt"), join(out, "music_plan.json"), join(out, "sfx_cues.json")],
    run: async () => runBuildVideo("timeline"),
  },
  {
    name: "audio",
    inputFiles: async () => [join(out, "music_plan.json"), join(out, "sfx_cues.json"), join(out, "voice/voice.wav"), join(out, "captions.ass")],
    params: () => ({}),
    outputFiles: () => [join(out, "music.wav"), join(out, "mix.wav")],
    run: async () => runBuildVideo("audio"),
  },
  {
    name: "render",
    inputFiles: async () => [join(out, "timeline.json"), ...(await glob(join(REPO, "packages/motion/web/templates"), ".js"))],
    params: () => ({ preset: PRESET, chunks: CHUNKS, crf: CRF }),
    outputFiles: () => [join(out, "video_raw.mp4")],
    run: async () => runBuildVideo("render", ["--preset", PRESET, "--chunks", CHUNKS]),
  },
  {
    name: "mux",
    inputFiles: async () => [join(out, "video_raw.mp4"), join(out, "mix.wav"), join(out, "captions.ass"), join(dir, "factbase.json"), join(dir, "script.json")],
    params: () => ({}),
    outputFiles: () => [join(out, "final.mp4"), join(out, "final_untertitelt.mp4"), join(out, "metadata.json"), join(out, "description.txt")],
    run: async () => runBuildVideo("mux"),
  },
  {
    name: "qa",
    inputFiles: async () => [join(out, "final.mp4")],
    params: () => ({ minDuration: MIN_DUR, maxDuration: MAX_DUR }),
    outputFiles: () => [join(out, "qa.json")],
    run: async () => runBuildVideo("qa", ["--min-duration", MIN_DUR, "--max-duration", MAX_DUR]),
  },
];

const ALL_STEP_NAMES = ["validate", ...steps.map((s) => s.name)];
function inRange(name: string): boolean {
  const names = ALL_STEP_NAMES;
  const from = FROM_STEP ? names.indexOf(FROM_STEP) : 0;
  const to = TO_STEP ? names.indexOf(TO_STEP) : names.length - 1;
  const i = names.indexOf(name);
  if (from < 0) throw new Error(`--from-step unbekannt: ${FROM_STEP}`);
  if (to < 0) throw new Error(`--to-step unbekannt: ${TO_STEP}`);
  return i >= from && i <= to;
}

async function main(): Promise<void> {
  // Existenzprüfung VOR jedem log()/mkdir-Aufruf - log() legt out/ sonst als Seiteneffekt an,
  // auch wenn der Produktionsordner selbst gar nicht existiert.
  if (!(await exists(dir))) { console.error(`Fehler: Produktionsordner existiert nicht: ${dir}`); process.exit(2); }
  if (!(await exists(join(dir, "script.json"))) && !(await exists(await pickStoryboard()))) {
    console.error(`Fehler: '${dir}' sieht nicht wie ein Produktionsordner aus (weder script.json noch Storyboard gefunden).`);
    process.exit(2);
  }
  await log(`=== Produktion gestartet: ${dir} ===`);

  // validate läuft immer vollständig (billig, prüft auch Umgebung/Modellpfad) - wird nie aus dem Cache übersprungen.
  if (inRange("validate")) {
    if (DRY) { await log("validate: würde jetzt laufen (--dry-run)"); }
    else {
      try { await stepValidate(); }
      catch (e) {
        await log(`Abgebrochen. Eingaben zuerst korrigieren, dann erneut aufrufen (validate hat keinen Zustand, wird immer neu geprüft).`);
        process.exit(1);
      }
    }
  }

  for (const step of steps) {
    if (!inRange(step.name)) { await log(`${step.name}: außerhalb --from-step/--to-step, übersprungen`); continue; }

    const inputFiles = (await step.inputFiles()).filter((f) => typeof f === "string");
    const params = step.params();
    const hash = await hashInputs(inputFiles, params);
    const prev = await readState(step.name);
    const outputsPresent = step.outputFiles().length === 0 || (await Promise.all(step.outputFiles().map(exists))).every(Boolean);

    if (!FORCE && prev && prev.status === "ok" && prev.inputHash === hash && outputsPresent) {
      await log(`${step.name}: übersprungen (Eingaben unverändert, Ausgaben vorhanden)`);
      continue;
    }
    if (DRY) { await log(`${step.name}: würde jetzt laufen (--dry-run, kein Aufruf)`); continue; }

    await log(`${step.name}: starte …`);
    const t0 = Date.now();
    try {
      await step.run();
      const durationMs = Date.now() - t0;
      await writeState(step.name, { inputHash: hash, params, status: "ok", completedAt: new Date().toISOString(), durationMs });
      await log(`${step.name}: fertig (${(durationMs / 1000).toFixed(1)} s)`);
    } catch (e) {
      const err = e as Error & { stderr?: string; stdout?: string };
      const durationMs = Date.now() - t0;
      const tail = [err.stderr, err.stdout].filter(Boolean).join("\n").split("\n").slice(-40).join("\n");
      await writeState(step.name, { inputHash: hash, params, status: "error", completedAt: new Date().toISOString(), durationMs, error: err.message });
      await log(`FEHLER in Schritt '${step.name}' nach ${(durationMs / 1000).toFixed(1)} s: ${err.message}`);
      if (tail) await log(`--- Ende der Fehlerausgabe (letzte Zeilen) ---\n${tail}\n--- --- ---`);
      await log(`Abgebrochen. Kein automatischer Neuversuch, kein Wechsel auf einen kostenpflichtigen Dienst. Erneut aufrufen, um ab '${step.name}' fortzusetzen.`);
      process.exit(1);
    }
  }

  if (await exists(join(out, "qa.json"))) {
    const qa = JSON.parse(await readFile(join(out, "qa.json"), "utf8")) as { issues?: string[] };
    if (qa.issues && qa.issues.length) {
      await log(`QA-WARNUNG: ${qa.issues.length} Punkt(e) gefunden – vor Veröffentlichung prüfen:`);
      for (const i of qa.issues) await log(`  - ${i}`);
    } else {
      await log("QA: keine Probleme gefunden.");
    }
  }
  await log("=== Produktion abgeschlossen ===");
}

main().catch(async (e) => { await log(`UNERWARTETER FEHLER: ${(e as Error).stack ?? e}`); process.exit(1); });
