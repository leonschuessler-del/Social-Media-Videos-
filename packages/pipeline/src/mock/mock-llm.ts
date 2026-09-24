import type { LLMProvider, LLMRequest, LLMResponse } from "@content-os/core";
import { ELEVATOR_FACTCHECK, ELEVATOR_METADATA_SHORT, ELEVATOR_RESEARCH, ELEVATOR_SCRIPT_SHORT, ELEVATOR_STORYBOARD_SHORT, ELEVATOR_TOPIC } from "../fixtures/elevator.ts";
import type { FactCheckOut, MetadataOut, ResearchOut, ScriptOut, ScriptQaOut, StoryboardOut, TopicIdeasOut, TopicScoreOut, VisualQaOut } from "../schemas.ts";

/**
 * Mock-LLM: deterministische, schema-konforme Antworten je Task (metadata.task).
 * Für das Testthema (Aufzugseil) liefert es kuratierte Inhalte; für andere Themen generische Platzhalter.
 * Kosten: 0. Dient ausschließlich dem Beweis der Pipeline-Mechanik – NICHT der Inhaltsqualität.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name = "mock";
  calls: { task: string; model: string }[] = [];

  async complete<T = unknown>(model: string, req: LLMRequest): Promise<LLMResponse<T>> {
    const task = req.metadata?.task ?? "unknown";
    const topic = req.metadata?.topicTitle ?? "";
    const format = (req.metadata?.format ?? "SHORT") as "SHORT" | "LONGFORM";
    this.calls.push({ task, model });
    const isElevator = /aufz[uü]g/i.test(topic) || /aufz[uü]g/i.test(req.prompt);
    const data = this.answer(task, isElevator, format, req);
    const text = JSON.stringify(data);
    return { text, json: data as T, model, usage: [{ provider: "mock", model, units: Math.ceil(req.prompt.length / 4), unitType: "input_tokens" }, { provider: "mock", model, units: Math.ceil(text.length / 4), unitType: "output_tokens" }], finishReason: "stop" };
  }

  private answer(task: string, elevator: boolean, format: "SHORT" | "LONGFORM", req: LLMRequest): unknown {
    switch (task) {
      case "topic.score": return { viralPotential: 0.8, curiosityGap: 0.85, visualPotential: 0.9, evergreenPotential: 0.9, searchDemand: 0.6, competition: 0.6, commercialValue: 0.55, novelty: 0.7, productionDifficulty: 0.7, factualRisk: 0.9, rationale: "Starkes Bild, klare Auflösung, technisch sauber belegbar.", suggestedAngle: elevator ? ELEVATOR_TOPIC.angle : "Unsichtbaren Mechanismus sichtbar machen." } satisfies TopicScoreOut;
      case "topic.discover": return { ideas: [
        { title: "Was passiert im Motor bei 8.000 U/min?", angle: "Kolbenbeschleunigung sichtbar machen", format: "SHORT", whyNow: "Evergreen", tags: ["motor"] },
        { title: "Was passiert bei einem Blitzschlag in ein Flugzeug?", angle: "Faradayscher Käfig in Zeitlupe", format: "LONGFORM", whyNow: "Evergreen", tags: ["blitz", "flugzeug"] },
        { title: "Was passiert in einer Mikrowelle wirklich?", angle: "Stehende Wellen und Hotspots", format: "SHORT", whyNow: "Evergreen", tags: ["mikrowelle"] },
      ] } satisfies TopicIdeasOut;
      case "research.synthesize": return elevator ? ELEVATOR_RESEARCH : genericResearch(req.metadata?.topicTitle ?? "Thema");
      case "factcheck.verify": return elevator ? ELEVATOR_FACTCHECK : ({ verdicts: [], overallRisk: "medium", mustFix: [] } satisfies FactCheckOut);
      case "script.write": return elevator ? (format === "SHORT" ? ELEVATOR_SCRIPT_SHORT : longformFromShort(ELEVATOR_SCRIPT_SHORT)) : genericScript(req.metadata?.topicTitle ?? "Thema");
      case "storyboard.build": return elevator ? (format === "SHORT" ? ELEVATOR_STORYBOARD_SHORT : longformStoryboard(ELEVATOR_STORYBOARD_SHORT)) : genericStoryboard(req.prompt);
      case "metadata.generate": return elevator ? ELEVATOR_METADATA_SHORT : ({ titleCandidates: ["Titel A", "Titel B"], selectedTitleIndex: 0, description: "Beschreibung.", tags: ["tag"], thumbnailHeadline: "WAS PASSIERT", thumbnailVariant: "center_burst" } satisfies MetadataOut);
      case "qa.script": return { factIssues: [], hookStrength: 0.78, retentionPrediction: 0.72, clarity: 0.85, policyConcerns: [], notes: "Mock-QA: keine Auffälligkeiten." } satisfies ScriptQaOut;
      case "qa.visual": return { frames: (req.images ?? []).map((_, i) => ({ frameIndex: i, quality: 0.7, artifacts: [], matchesIntent: true, textLegible: true, notes: "Mock-Platzhalterbild" })), overallVisualQuality: 0.7, criticalProblems: [] } satisfies VisualQaOut;
      default: return { ok: true, note: `Mock ohne Fixture für ${task}` };
    }
  }
}

function genericResearch(title: string): ResearchOut {
  return { summary: `Platzhalter-Recherche zu "${title}" (Mock).`, keyFacts: ["Fakt 1 (Mock)", "Fakt 2 (Mock)"], claims: [{ text: `Claim 1 zu ${title} (Mock)`, sourceUrls: ["https://example.org/quelle"], confidence: 0.6, category: "other" }], sources: [{ url: "https://example.org/quelle", title: "Beispielquelle", publisher: "example.org", sourceType: "other", reliability: 0.5 }], openQuestions: [], riskFlags: ["MOCK"] };
}
function genericScript(title: string): ScriptOut {
  return { title, hookType: "QUESTION", sections: [
    { kind: "HOOK", narration: `${title} Die Antwort ist überraschend.`, claimIndexes: [0], targetSeconds: 5, visualIntent: "Hook-Bild" },
    { kind: "EXPLANATION", narration: "Hier folgt die Erklärung in drei klaren Schritten. Schritt eins. Schritt zwei. Schritt drei.", claimIndexes: [0], targetSeconds: 15, visualIntent: "Querschnitt" },
    { kind: "PAYOFF", narration: "Und genau deshalb passiert am Ende das Unerwartete.", claimIndexes: [0], targetSeconds: 6, visualIntent: "Payoff" },
  ], styleNotes: "mock" };
}
function genericStoryboard(prompt: string): StoryboardOut {
  const m = prompt.match(/SKRIPT-ABSCHNITTE:\n([\s\S]*)$/);
  const lines = (m?.[1] ?? "").split("\n").filter((l) => /^\d+ \[/.test(l));
  const scenes = lines.map((l, i) => ({ sectionIndex: i, narration: l.replace(/^\d+ \[[^\]]+\]: /, ""), visualDescription: `Szene ${i}`, generationPrompt: `technical visualization scene ${i}`, negativePrompt: "text", method: "IMAGE_KENBURNS" as const, camera: (["push_in", "pull_out", "pan_left", "pan_right"] as const)[i % 4]!, transitionIn: "dissolve" as const, soundDesign: "", overlayText: "", overlayStyle: "none" as const, visualStyleTag: ["xray", "macro", "cross_section"][i % 3]!, infographic: null }));
  return { visualStyle: "mock", colorPalette: ["#000"], scenes };
}
/** Longform-Prototyp aus dem Short-Skript: gleiche Fakten, mehr Tiefe (deterministisch erweitert). */
function longformFromShort(s: ScriptOut): ScriptOut {
  const extra: ScriptOut["sections"] = [
    { kind: "SETUP", narration: "Bevor wir ins Detail gehen, ein Blick auf das Gesamtsystem. Ein Aufzug ist im Kern eine Waage: Auf der einen Seite die Kabine, auf der anderen ein Gegengewicht, das die Kabine plus etwa die Hälfte ihrer Nennlast ausgleicht. Der Motor bewegt nur die Differenz. Genau deshalb reichen vergleichsweise kleine Antriebe für tonnenschwere Lasten.", claimIndexes: [5], targetSeconds: 22, visualIntent: "X-Ray des kompletten Schachts mit Kabine, Gegengewicht, Treibscheibe" },
    { kind: "EXPLANATION", narration: "Oben im Maschinenraum sitzt die Treibscheibe. Die Seile liegen in ihren Rillen und werden allein durch Reibung mitgenommen. Daneben die Antriebsbremse: federbelastet, elektrisch gelüftet. Fällt der Strom aus, lassen die Magnete los und die Federn drücken die Bremse zu. Der Aufzug hält an – nicht trotz, sondern wegen des Stromausfalls.", claimIndexes: [6], targetSeconds: 24, visualIntent: "Querschnitt Treibscheibe und Bremse, Federn schließen" },
    { kind: "PATTERN_INTERRUPT", narration: "Kleiner Realitätscheck: Filme zeigen gern stürzende Kabinen. In der Statistik kommen solche Seilriss-Abstürze bei modernen Personenaufzügen praktisch nicht vor. Die seltenen schweren Unfälle passieren bei Wartung oder durch offene Türen – nicht durch gerissene Seile.", claimIndexes: [0], targetSeconds: 18, visualIntent: "Kontrast: Filmklischee vs. nüchterne Statistik-Grafik" },
    { kind: "EXPLANATION", narration: "Zurück zur Fangvorrichtung. Es gibt zwei Bauarten. Der Sperrfang packt schlagartig zu – geeignet für langsame Aufzüge. Der Gleitfang bremst kontrolliert über eine Strecke ab, damit die Verzögerung für Menschen erträglich bleibt. Beide arbeiten rein mechanisch, ausgelöst vom Begrenzer.", claimIndexes: [2], targetSeconds: 22, visualIntent: "Vergleich Sperrfang vs. Gleitfang als animierter Querschnitt" },
    { kind: "OUTRO", narration: "Das Seil ist also nur der sichtbarste Teil einer ganzen Sicherheitskette: mehrere Seile, Begrenzer, Fangvorrichtung, Puffer, Bremse. Jede Schicht fängt die vorige auf. Beim nächsten Mal zeigen wir, was im Inneren eines Motors bei achttausend Umdrehungen passiert. Bis dahin: Abonnieren.", claimIndexes: [0, 2, 4, 6], targetSeconds: 20, visualIntent: "Übersicht aller Sicherheitsschichten, dann Teaser" },
  ];
  const base = s.sections.filter((x) => x.kind !== "CTA");
  const sections = [base[0]!, base[1]!, extra[0]!, extra[1]!, base[2]!, base[3]!, extra[2]!, extra[3]!, base[4]!, extra[4]!];
  return { ...s, title: "Warum ein Aufzug nie abstürzt – die unsichtbare Sicherheitskette", sections };
}
function longformStoryboard(s: StoryboardOut): StoryboardOut {
  // Longform-Prototyp: Short-Szenen + zusätzliche Szenen; Narration wird vom Storyboard-Stage bei Inkonsistenz deterministisch neu verteilt
  const extra = [
    { desc: "X-Ray des kompletten Schachts mit Kabine, Gegengewicht und Treibscheibe", prompt: "Full x-ray cutaway of an elevator shaft showing car, counterweight, traction sheave and cables, glowing teal outlines, amber highlights, dark background, cinematic technical illustration", tag: "xray", cam: "pull_out" },
    { desc: "Treibscheibe mit Seilrillen, Reibung visualisiert", prompt: "Close-up cross-section of an elevator traction sheave with steel ropes seated in grooves, friction visualized as glowing contact points, dark background, teal and amber, cinematic", tag: "cross_section", cam: "push_in" },
    { desc: "Federbelastete Antriebsbremse schließt bei Stromausfall", prompt: "Cutaway of a spring-applied electromagnetic elevator brake closing onto a drum, springs compressing, magnet releasing, technical x-ray look, teal and amber lighting", tag: "simulation", cam: "pan_left" },
    { desc: "Kontrast Filmklischee vs. Statistik", prompt: "Split composition: dramatic falling elevator cliche on the left fading out, calm technical schematic on the right, dark background, teal accent, no text", tag: "cinematic", cam: "static" },
    { desc: "Sperrfang vs. Gleitfang Vergleich", prompt: "Side-by-side cutaway of two elevator safety gear types: instantaneous wedge type and progressive sliding type, both gripping a guide rail, technical illustration, teal outlines, amber highlights", tag: "cross_section", cam: "pan_right" },
    { desc: "Übersicht aller Sicherheitsschichten als Ebenen", prompt: "Layered exploded-view illustration of elevator safety systems stacked as translucent planes: cables, governor, safety gear, buffers, brake, dark background, teal glow, no text", tag: "diagram", cam: "pull_out" },
  ];
  const scenes = [...s.scenes.filter((x) => x.method !== "TEXT_CARD"), ...extra.map((e, i) => ({ sectionIndex: Math.min(9, 6 + i), narration: "", visualDescription: e.desc, generationPrompt: e.prompt, negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS" as const, camera: e.cam as "push_in", transitionIn: "dissolve" as const, soundDesign: "low drone", overlayText: "", overlayStyle: "none" as const, visualStyleTag: e.tag, infographic: null })), s.scenes.find((x) => x.method === "TEXT_CARD")!];
  return { ...s, scenes };
}
