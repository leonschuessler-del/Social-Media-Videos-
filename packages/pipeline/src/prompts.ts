import type { Project, ResearchDoc, Script, VideoFormat } from "@content-os/core";

export const SYSTEM_BASE = `Du bist Teil einer Produktionspipeline für einen deutschsprachigen YouTube-Kanal im Genre "Visual Edutainment / Was passiert, wenn …?".
Leitidee: Dinge sichtbar machen, die Menschen normalerweise nicht sehen können (Querschnitte, X-Ray, Zeitlupe, Simulation).
Regeln: Keine erfundenen Fakten. Unsicheres als unsicher markieren. Keine medizinischen Ratschläge. Keine reißerischen Falschbehauptungen.
Antworte ausschließlich im geforderten JSON-Format.`;

export function targetSeconds(format: VideoFormat): { min: number; target: number; max: number } {
  return format === "SHORT" ? { min: 25, target: 40, max: 58 } : { min: 480, target: 600, max: 900 };
}

export function researchPrompt(topicTitle: string, angle: string): string {
  return `Recherchiere das Thema für ein Erklärvideo:
THEMA: ${topicTitle}
BLICKWINKEL: ${angle}

Aufgaben:
1. Fasse den Sachverhalt in 5–8 Sätzen zusammen (was passiert physikalisch/technisch, Schritt für Schritt).
2. Liste 8–15 Kernfakten (jeweils 1 Satz, konkret, mit Zahlen wo belegt).
3. Formuliere 6–12 überprüfbare Claims mit Quellen-URLs (bevorzugt Primär-/Fachquellen, Hersteller-/Behördendokumente, Lehrbücher, peer-reviewed).
4. Liste die Quellen mit Verlässlichkeit (0–1).
5. Nenne offene Fragen und Risiko-Flags (z.B. "Sicherheitsrelevant", "Zahlen variieren je Bauart").
Nutze Websuche, wenn verfügbar. Erfinde keine URLs.`;
}

export function factCheckPrompt(research: ResearchDoc): string {
  const claims = research.claims.map((c, i) => `${i}. ${c.text} [Quellen: ${c.sourceIds.map((id) => research.sources.find((s) => s.id === id)?.url ?? id).join(", ")}]`).join("\n");
  return `Prüfe unabhängig folgende Claims. Suche nach Gegenbelegen. Sei streng: ein Claim ist nur SUPPORTED, wenn mindestens eine verlässliche Quelle ihn direkt stützt.
CLAIMS:
${claims}

Gib je Claim ein Urteil, Konfidenz, Notizen und ggf. eine korrigierte Formulierung. Nenne mustFix-Punkte, die das Skript zwingend berücksichtigen muss.`;
}

export function scriptPrompt(project: Project, topicTitle: string, angle: string, format: VideoFormat, research: ResearchDoc, factCheckNotes: string[]): string {
  const t = targetSeconds(format);
  const wpm = 150;
  const words = Math.round((t.target / 60) * wpm);
  const claims = research.claims.map((c, i) => `${i}. ${c.text} (${c.verdict ?? "n/a"})`).join("\n");
  return `Schreibe das Voiceover-Skript (Deutsch, ${format === "SHORT" ? "Short, 9:16" : "Longform, 16:9"}).
THEMA: ${topicTitle}
BLICKWINKEL: ${angle}
ZIEL-LÄNGE: ca. ${t.target}s (${words} Wörter bei ${wpm} WpM). Bereich ${t.min}–${t.max}s.
STIL: ${project.styleGuide.narrationTone}. HOOK-STIL: ${project.styleGuide.hookStyle}.
FAKTENBASIS (nur diese Claims verwenden, keine neuen Zahlen erfinden):
${claims}
FACT-CHECK-HINWEISE: ${factCheckNotes.join(" | ") || "keine"}

Struktur: HOOK (erste 3 Sekunden = konkretes Bild + offene Frage) -> SETUP -> EXPLANATION (in 3–6 visuellen Schritten, jeder Abschnitt = neuer Bildwechsel) -> ggf. PATTERN_INTERRUPT -> PAYOFF (die überraschende Antwort) -> ${format === "SHORT" ? "kurzer CTA (max 1 Satz)" : "OUTRO mit Ausblick + CTA"}.
Jeder Abschnitt: narration (gesprochener Text), claimIndexes (welche Claims belegt werden), targetSeconds, visualIntent (was der Zuschauer sieht).
Kein Füllmaterial. Kurze Sätze. Zahlen konkret. Curiosity Loops öffnen und schließen.`;
}

export function storyboardPrompt(project: Project, script: Script, format: VideoFormat, opts: { videoGenerationAvailable: boolean; sceneSeconds: number }): string {
  const sections = script.sections.map((s, i) => `${i} [${s.kind}, ${s.targetSeconds}s]: ${s.narration}\n   visual: ${s.visualIntent}`).join("\n");
  return `Zerlege das Skript in Szenen (${format === "SHORT" ? "Hochformat 9:16" : "Querformat 16:9"}). Zielszenendauer ~${opts.sceneSeconds}s; jede Szene bekommt genau den Narrationstext, der währenddessen gesprochen wird (Narration lückenlos und in Reihenfolge auf Szenen verteilen, kein Wort weglassen, nichts hinzufügen).
VISUELLER STIL DES KANALS: ${project.styleGuide.visualStyle}
FARBEN: ${project.styleGuide.brandColors.primary}, ${project.styleGuide.brandColors.accent}, Hintergrund ${project.styleGuide.brandColors.background}
${opts.videoGenerationAvailable ? "Methoden: IMAGE_KENBURNS (Standard), IMAGE_TO_VIDEO nur für 1–2 Hero-Szenen." : "WICHTIG: Es ist KEINE KI-Videogenerierung verfügbar. Nutze ausschließlich IMAGE_KENBURNS, INFOGRAPHIC, TEXT_CARD. Bewegung entsteht über Kamera (push_in/pull_out/pan) und Schnitt."}
generationPrompt: englischer, präziser Bildprompt (Motiv, Perspektive, Licht, Stil "${project.styleGuide.visualStyle}", keine Textelemente im Bild, keine echten Personen/Marken/Logos). negativePrompt: was vermieden werden soll.
overlayText: kurzer Text-Overlay (Zahl/Label) oder leer. infographic: nur bei method INFOGRAPHIC (title/value/label), sonst null.
visualStyleTag: eines von xray, cross_section, macro, simulation, cinematic, diagram, text.
Vermeide zwei aufeinanderfolgende Szenen mit gleichem visualStyleTag. Pattern Interrupt alle 3–4 Szenen.

SKRIPT-ABSCHNITTE:
${sections}`;
}

export function metadataPrompt(script: Script, format: VideoFormat, sourcesText: string): string {
  return `Erzeuge YouTube-Metadaten (Deutsch) für ${format === "SHORT" ? "ein Short" : "ein Longform-Video"}.
SKRIPT-TITEL: ${script.title}
NARRATION: ${script.fullNarration.slice(0, 4000)}

Regeln: 5 Titelvarianten (max 60 Zeichen, konkret, Curiosity Gap, keine Clickbait-Lügen, ${format === "SHORT" ? "mit #Shorts am Ende" : "ohne Hashtags"}). Wähle die beste (selectedTitleIndex).
Beschreibung: 2–4 Absätze, erste Zeile = Hook, dann Kurzfassung, dann "Quellen:" (werden automatisch angehängt: ${sourcesText ? "ja" : "nein"}), dann Hinweis, dass Visualisierungen KI-generiert/animiert sind.
Tags: 10–20 relevante Keywords. thumbnailHeadline: 2–4 Wörter, groß lesbar, wahr. thumbnailVariant: passendes Layout.`;
}

export function scriptQaPrompt(script: Script, research: ResearchDoc): string {
  return `Prüfe dieses Skript gegen die Faktenbasis. Melde Aussagen, die nicht durch die Claims gedeckt sind, übertrieben oder irreführend sind.
Bewerte hookStrength (0–1), retentionPrediction (0–1), clarity (0–1). Liste policyConcerns (YouTube: irreführend, gefährliche Handlungen, medizinische Ratschläge, Gewaltdarstellung).
CLAIMS:
${research.claims.map((c, i) => `${i}. ${c.text} (${c.verdict ?? "n/a"})`).join("\n")}
SKRIPT:
${script.fullNarration}`;
}

export function visualQaPrompt(sceneDescriptions: string[]): string {
  return `Du siehst ${sceneDescriptions.length} Frames aus einem Video. Prüfe je Frame: Bildqualität (0–1), Artefakte (verzerrte Anatomie, kaputte Geometrie, unlesbarer Text, Wasserzeichen), ob das Bild zur Szenenbeschreibung passt, ob eingeblendeter Text lesbar ist.
SZENEN:
${sceneDescriptions.map((d, i) => `${i}: ${d}`).join("\n")}`;
}

export function topicScorePrompt(title: string, angle: string, format: VideoFormat, existingTitles: string[]): string {
  return `Bewerte diese Videoidee für unseren Kanal (${format}). Skala je Faktor 0–1 (1 = optimal; bei competition/productionDifficulty/factualRisk bedeutet 1 = wenig Konkurrenz / einfach / geringes Risiko).
IDEE: ${title}
BLICKWINKEL: ${angle}
BEREITS PRODUZIERTE THEMEN: ${existingTitles.slice(0, 50).join(" | ") || "keine"}
Gib rationale und einen verbesserten suggestedAngle.`;
}

export function topicDiscoverPrompt(niche: string, existingTitles: string[], n: number): string {
  return `Finde ${n} neue Videoideen für die Nische "${niche}" (Format-Mix Short/Longform). Kriterien: visuell stark (etwas, das man normalerweise nicht sehen kann), starker Curiosity Gap, sauber recherchierbar, Evergreen, keine medizinischen Ratschläge, keine Gewaltverherrlichung.
Nutze Websuche für aktuelle Trends/Suchinteresse, bevorzuge aber zeitlose Themen.
BEREITS VORHANDEN (vermeiden): ${existingTitles.join(" | ") || "keine"}`;
}
