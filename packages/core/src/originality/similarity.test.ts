import { describe, expect, it } from "vitest";
import { sequenceSimilarity, shortTextSimilarity, textSimilarity } from "./similarity.ts";

describe("similarity", () => {
  it("identisch = 1, verschieden ≈ 0", () => {
    expect(textSimilarity("Was passiert wenn ein Aufzugseil reißt", "Was passiert wenn ein Aufzugseil reißt")).toBe(1);
    expect(textSimilarity("Was passiert wenn ein Aufzugseil reißt", "Warum Vulkane ausbrechen und Lava fließt")).toBeLessThan(0.1);
  });
  it("kurze Texte", () => {
    expect(shortTextSimilarity("Was passiert, wenn ein Aufzugseil reißt?", "Was passiert wenn das Aufzugseil reißt")).toBeGreaterThan(0.5);
  });
  it("sequenzen", () => {
    expect(sequenceSimilarity(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
    expect(sequenceSimilarity(["a", "b", "c"], ["x", "y"])).toBe(0);
  });
});
