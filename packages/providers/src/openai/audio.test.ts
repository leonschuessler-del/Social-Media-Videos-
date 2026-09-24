import { describe, expect, it } from "vitest";
import { chunkText } from "./audio.ts";
import { nearestSize } from "./image.ts";

describe("openai helpers", () => {
  it("chunkText hält 4096-Zeichen-Limit ein und trennt an Satzgrenzen", () => {
    const text = Array.from({ length: 120 }, (_, i) => `Satz Nummer ${i} beschreibt die Fangvorrichtung im Detail.`).join(" ");
    const chunks = chunkText(text, 1000);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("nearestSize wählt Standardformate", () => {
    expect(nearestSize(1920, 1080)).toBe("1536x1024");
    expect(nearestSize(1080, 1920)).toBe("1024x1536");
    expect(nearestSize(1024, 1024)).toBe("1024x1024");
  });
});
