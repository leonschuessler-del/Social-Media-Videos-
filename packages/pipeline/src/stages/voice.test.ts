import { describe, expect, it } from "vitest";
import { alignScenesToWords } from "./voice.ts";
import { nextPublishSlot } from "./publish.ts";
import type { Scene } from "@content-os/core";

const scene = (id: string, narration: string): Scene => ({ id, scriptId: "s", index: 0, sectionId: "x", durationSec: 0, narration, visualDescription: "", generationPrompt: "", method: "IMAGE_KENBURNS", camera: "static", transitionIn: "cut", soundDesign: "", claimIds: [], visualStyleTag: "xray", assetIds: [] });

describe("alignScenesToWords", () => {
  it("verteilt Szenen lückenlos entlang der Wort-Zeitstempel", () => {
    const words = ["Was", "passiert", "wenn", "ein", "Seil", "reißt?", "Fast", "nichts."].map((w, i) => ({ word: w, startSec: i * 0.5, endSec: i * 0.5 + 0.4 }));
    const t = alignScenesToWords([scene("a", "Was passiert wenn ein Seil reißt?"), scene("b", "Fast nichts.")], words, 4.5);
    expect(t[0]).toEqual({ sceneId: "a", startSec: 0, endSec: 3 });
    expect(t[1]!.startSec).toBe(3);
    expect(t[1]!.endSec).toBe(4.5);
  });
  it("erzwingt Mindestdauer 1s und Ende = Gesamtdauer", () => {
    const words = [{ word: "Hi", startSec: 0, endSec: 0.2 }, { word: "da", startSec: 0.25, endSec: 0.4 }];
    const t = alignScenesToWords([scene("a", "Hi"), scene("b", "da")], words, 10);
    expect(t[0]!.endSec - t[0]!.startSec).toBeGreaterThanOrEqual(1);
    expect(t[1]!.endSec).toBe(10);
  });
});

describe("nextPublishSlot", () => {
  it("liegt in der Zukunft und zur gewünschten lokalen Stunde", () => {
    const from = new Date("2026-09-24T12:00:00Z");
    const slot = nextPublishSlot(17, "Europe/Berlin", from);
    expect(slot.getTime()).toBeGreaterThan(from.getTime());
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(slot));
    expect(hour % 24).toBe(17);
  });
  it("springt auf den nächsten Tag, wenn die Stunde vorbei ist", () => {
    const from = new Date("2026-09-24T16:30:00Z"); // 18:30 Berlin
    const slot = nextPublishSlot(17, "Europe/Berlin", from);
    expect(slot.toISOString().slice(0, 10)).toBe("2026-09-25");
  });
});
