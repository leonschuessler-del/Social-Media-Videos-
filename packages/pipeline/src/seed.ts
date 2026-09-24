import type { Project, Store } from "@content-os/core";

/** Projekt 01 – Visual Science (Default-Styleguide). */
export async function seedProject01(store: Store, overrides: Partial<Project> = {}): Promise<Project> {
  const existing = await store.projects.getBySlug(overrides.slug ?? "visual-science");
  if (existing) return existing;
  return store.projects.create({
    slug: "visual-science",
    name: "Project 01 – Visual Science",
    niche: "AI Visual Edutainment / Was passiert, wenn …? – Dinge sichtbar machen, die man normalerweise nicht sehen kann (Technik, Physik, Natur)",
    language: "de",
    reviewMode: "SAFE",
    maxVideosPerDay: 3,
    autoApproveThreshold: 0.85,
    minPublishScore: 0.65,
    rulesVersion: 1,
    active: true,
    styleGuide: {
      visualStyle: "cinematic technical visualization, x-ray / cross-section look, dark background, volumetric light, teal and amber accents, ultra-detailed, no text",
      narrationTone: "neugierig, präzise, ruhig-spannend, keine Übertreibung, kurze Sätze",
      hookStyle: "Frage-Hook mit konkretem Bild in Sekunde 1, dann Cliffhanger",
      voiceId: undefined,
      fontFamily: "DejaVu Sans",
      brandColors: { primary: "#19C6D1", accent: "#FFB347", background: "#0B1220", text: "#FFFFFF" },
      captionStyle: "word",
      disclosureText: "Hinweis: Die Visualisierungen in diesem Video sind KI-generierte bzw. animierte Darstellungen und zeigen keine realen Aufnahmen.",
    },
    ...overrides,
  });
}
