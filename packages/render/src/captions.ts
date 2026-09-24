import type { WordTimestamp } from "@content-os/core";

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number; // in Pixeln relativ zur PlayRes
  primaryColor: string; // "#RRGGBB"
  highlightColor: string;
  outlineColor: string;
  marginV: number;
  playResX: number;
  playResY: number;
  bold?: boolean;
}

function assColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H${alpha.toString(16).padStart(2, "0").toUpperCase()}${b}${g}${r}`.toUpperCase();
}

function assTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(Math.min(99, cs)).padStart(2, "0")}`;
}

function escAss(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\n/g, "\\N");
}

/**
 * Gruppiert Wörter in Zeilen (max. Wörter/Zeichen) und erzeugt ASS mit Wort-Highlighting
 * (aktuelles Wort in highlightColor) – Shorts-typischer "Karaoke"-Stil ohne Overkill.
 */
export function buildAss(words: WordTimestamp[], style: CaptionStyle, opts: { maxWordsPerLine?: number; maxCharsPerLine?: number; mode: "word" | "line" } = { mode: "word" }): string {
  const maxWords = opts.maxWordsPerLine ?? (style.playResX > style.playResY ? 7 : 4);
  const maxChars = opts.maxCharsPerLine ?? (style.playResX > style.playResY ? 42 : 22);
  const lines: WordTimestamp[][] = [];
  let cur: WordTimestamp[] = [];
  let curLen = 0;
  for (const w of words) {
    const endsSentence = /[.!?]$/.test(w.word);
    if (cur.length && (cur.length >= maxWords || curLen + w.word.length + 1 > maxChars)) { lines.push(cur); cur = []; curLen = 0; }
    cur.push(w); curLen += w.word.length + 1;
    if (endsSentence && cur.length >= 2) { lines.push(cur); cur = []; curLen = 0; }
  }
  if (cur.length) lines.push(cur);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${style.playResX}
PlayResY: ${style.playResY}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${style.fontFamily},${style.fontSize},${assColor(style.primaryColor)},${assColor(style.highlightColor)},${assColor(style.outlineColor)},${assColor("#000000", 0x80)},${style.bold === false ? 0 : -1},0,0,0,100,100,0,0,1,${Math.max(2, Math.round(style.fontSize / 14))},${Math.max(1, Math.round(style.fontSize / 30))},2,60,60,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  for (const line of lines) {
    const start = line[0]!.startSec;
    const end = line[line.length - 1]!.endSec + 0.05;
    if (opts.mode === "line") {
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,${escAss(line.map((w) => w.word).join(" "))}`);
      continue;
    }
    // Wort-Highlight: pro Wort ein Event mit dem gesamten Zeilentext, aktives Wort farbig
    for (let i = 0; i < line.length; i++) {
      const ws = line[i]!.startSec;
      const we = i + 1 < line.length ? line[i + 1]!.startSec : end;
      const text = line.map((w, j) => (j === i ? `{\\c${assColor(style.highlightColor)}}${escAss(w.word)}{\\c${assColor(style.primaryColor)}}` : escAss(w.word))).join(" ");
      events.push(`Dialogue: 0,${assTime(ws)},${assTime(we)},Cap,,0,0,0,,${text}`);
    }
  }
  return header + events.join("\n") + "\n";
}

/** SRT als Sidecar (für YouTube-Upload als Untertitel-Datei). */
export function buildSrt(words: WordTimestamp[], maxWords = 8): string {
  const out: string[] = [];
  let idx = 1;
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords);
    const s = chunk[0]!.startSec, e = chunk[chunk.length - 1]!.endSec;
    const fmt = (t: number) => { const d = new Date(Math.round(t * 1000)); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")},${String(d.getUTCMilliseconds()).padStart(3, "0")}`; };
    out.push(`${idx++}\n${fmt(s)} --> ${fmt(e)}\n${chunk.map((w) => w.word).join(" ")}\n`);
  }
  return out.join("\n");
}
