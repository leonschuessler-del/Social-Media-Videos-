import { describe, expect, it } from "vitest";
import { buildAss, buildSrt } from "./captions.ts";

const words = "Was passiert wenn ein Aufzugseil reißt? Fast nichts.".split(" ").map((w, i) => ({ word: w, startSec: i * 0.4, endSec: i * 0.4 + 0.3 }));
const style = { fontFamily: "DejaVu Sans", fontSize: 80, primaryColor: "#FFFFFF", highlightColor: "#FFB347", outlineColor: "#000000", marginV: 400, playResX: 1080, playResY: 1920 };

describe("captions", () => {
  it("ASS mit Wort-Highlight: ein Event je Wort, Zeilenumbruch am Satzende", () => {
    const ass = buildAss(words, style, { mode: "word" });
    expect(ass).toContain("[V4+ Styles]");
    expect((ass.match(/^Dialogue:/gm) ?? []).length).toBe(words.length);
    expect(ass).toContain("&H0047B3FF"); // Highlight-Farbe (BGR) im Event
  });
  it("ASS line-mode: ein Event je Zeile", () => {
    const ass = buildAss(words, style, { mode: "line" });
    expect((ass.match(/^Dialogue:/gm) ?? []).length).toBeLessThan(words.length);
  });
  it("SRT sidecar", () => {
    const srt = buildSrt(words, 4);
    expect(srt).toMatch(/^1\n00:00:00,000 --> /);
  });
});
