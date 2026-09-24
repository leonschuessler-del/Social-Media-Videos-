/**
 * Fixture für das erste Testthema: "Was passiert, wenn ein Aufzugseil reißt?"
 * Inhalte sind Standard-Lehrbuch-/Normenwissen (EN 81, Otis 1854) – dienen im Mock-Modus als deterministische LLM-Antworten.
 * Im Live-Modus recherchiert das LLM mit Websuche selbst; diese Fixture ist dann NICHT aktiv.
 */
import type { FactCheckOut, MetadataOut, ResearchOut, ScriptOut, StoryboardOut } from "../schemas.ts";

export const ELEVATOR_TOPIC = {
  title: "Was passiert, wenn ein Aufzugseil reißt?",
  angle: "Der Fahrstuhl stürzt NICHT ab – wir zeigen die unsichtbare Sicherheitskette in Zeitlupe: mehrere Tragseile, Geschwindigkeitsbegrenzer, Fangvorrichtung, Puffer.",
};

export const ELEVATOR_RESEARCH: ResearchOut = {
  summary: "Moderne Personenaufzüge hängen nicht an einem einzelnen Seil, sondern an mehreren parallelen Tragseilen oder Gurten, von denen jedes einzeln die volle Last mit hohem Sicherheitsfaktor tragen kann. Reißt ein Seil, tragen die anderen weiter. Würden alle Seile ausfallen, überwacht ein Geschwindigkeitsbegrenzer die Kabinengeschwindigkeit; bei Überschreitung löst er mechanisch die Fangvorrichtung aus, die Bremsbacken gegen die Führungsschienen presst und die Kabine innerhalb kurzer Strecke stoppt. Am Schachtboden fangen Puffer die Restenergie ab. Dieses Prinzip geht auf Elisha Otis zurück, der 1854 in New York seine Fangvorrichtung öffentlich vorführte, indem er das Seil durchtrennen ließ.",
  keyFacts: [
    "Personenaufzüge nutzen in der Regel mehrere Tragseile (häufig 3 bis 8) oder Flachgurte parallel.",
    "Jedes einzelne Tragseil ist mit einem hohen Sicherheitsfaktor ausgelegt; Normen wie EN 81-20/50 fordern für Stahldrahtseile einen Sicherheitsfaktor von mindestens 12.",
    "Ein Geschwindigkeitsbegrenzer (Overspeed Governor) überwacht die Kabinengeschwindigkeit über ein separates Seil.",
    "Überschreitet die Kabine die Nenngeschwindigkeit deutlich, löst der Begrenzer mechanisch die Fangvorrichtung aus – ohne Strom.",
    "Die Fangvorrichtung presst Bremselemente gegen die Führungsschienen und bremst die Kabine kontrolliert ab.",
    "Am Schachtende sitzen Puffer (Feder- oder Hydraulikpuffer), die eine ankommende Kabine zusätzlich abfangen.",
    "Elisha Otis demonstrierte 1854 auf der Ausstellung im Crystal Palace in New York seine Sicherheitsfangvorrichtung, indem er das Halteseil durchtrennen ließ.",
    "Aufzüge gehören statistisch zu den sichersten Verkehrsmitteln; tödliche Unfälle betreffen fast nie Seilrisse, sondern z. B. Wartungsarbeiten.",
    "Ein Gegengewicht balanciert die Kabine plus etwa die Hälfte der Nennlast aus, der Motor bewegt nur die Differenz.",
    "Die Bremse am Antrieb hält die Kabine im Stillstand; sie ist federbelastet und greift bei Stromausfall automatisch.",
  ],
  claims: [
    { text: "Personenaufzüge werden von mehreren parallelen Tragseilen oder Gurten getragen, nicht von einem einzelnen Seil.", sourceUrls: ["https://www.tuvsud.com/de-de/branchen/immobilien/aufzuege"], confidence: 0.95, category: "engineering" },
    { text: "Normen für Aufzüge (EN 81-20/50) verlangen für Tragseile einen Sicherheitsfaktor von mindestens 12.", sourceUrls: ["https://www.beuth.de/de/norm/din-en-81-50/"], confidence: 0.85, category: "engineering" },
    { text: "Ein Geschwindigkeitsbegrenzer löst bei Übergeschwindigkeit mechanisch die Fangvorrichtung aus, die die Kabine an den Führungsschienen bremst.", sourceUrls: ["https://www.tuvsud.com/de-de/branchen/immobilien/aufzuege"], confidence: 0.95, category: "engineering" },
    { text: "Elisha Otis führte 1854 in New York seine Sicherheitsfangvorrichtung vor, indem er das Tragseil durchtrennen ließ.", sourceUrls: ["https://www.otis.com/de/de/about/history"], confidence: 0.95, category: "history" },
    { text: "Puffer am Schachtboden fangen eine ankommende Kabine zusätzlich ab.", sourceUrls: ["https://www.tuvsud.com/de-de/branchen/immobilien/aufzuege"], confidence: 0.9, category: "engineering" },
    { text: "Ein Gegengewicht gleicht Kabine plus etwa die Hälfte der Nennlast aus.", sourceUrls: ["https://www.tuvsud.com/de-de/branchen/immobilien/aufzuege"], confidence: 0.85, category: "engineering" },
    { text: "Die Antriebsbremse ist federbelastet und greift bei Stromausfall automatisch.", sourceUrls: ["https://www.beuth.de/de/norm/din-en-81-20/"], confidence: 0.85, category: "engineering" },
  ],
  sources: [
    { url: "https://www.tuvsud.com/de-de/branchen/immobilien/aufzuege", title: "TÜV SÜD – Aufzüge: Sicherheit und Prüfung", publisher: "TÜV SÜD", sourceType: "official", reliability: 0.85 },
    { url: "https://www.beuth.de/de/norm/din-en-81-20/", title: "DIN EN 81-20 – Sicherheitsregeln für Aufzüge", publisher: "DIN/Beuth", sourceType: "primary", reliability: 0.95 },
    { url: "https://www.beuth.de/de/norm/din-en-81-50/", title: "DIN EN 81-50 – Prüfungen und Berechnungen", publisher: "DIN/Beuth", sourceType: "primary", reliability: 0.95 },
    { url: "https://www.otis.com/de/de/about/history", title: "Otis – Unternehmensgeschichte", publisher: "Otis", sourceType: "official", reliability: 0.8 },
  ],
  openQuestions: ["Genaue Seilanzahl variiert je Aufzugtyp – im Video als Bereich nennen.", "Bremsweg der Fangvorrichtung hängt von Bauart (Gleit-/Sperrfang) ab."],
  riskFlags: ["Sicherheitsrelevant: keine Verhaltensanweisungen für Notfälle geben."],
};

export const ELEVATOR_FACTCHECK: FactCheckOut = {
  verdicts: ELEVATOR_RESEARCH.claims.map((c, i) => ({ claimIndex: i, verdict: i === 1 ? "PARTIALLY_SUPPORTED" : "SUPPORTED", confidence: i === 1 ? 0.75 : 0.9, notes: i === 1 ? "Faktor 12 gilt für bestimmte Seil-/Treibscheibenkonfigurationen; als 'mindestens 12' formulieren." : "Standardwissen, konsistent mit Normen/Herstellerangaben.", correction: i === 1 ? "Normen für Aufzüge fordern für Tragseile einen hohen Sicherheitsfaktor – bei Stahldrahtseilen typischerweise mindestens 12." : "" })),
  overallRisk: "low",
  mustFix: ["Keine Anweisungen, was Passagiere im Notfall tun sollen (nur Technik erklären)."],
};

export const ELEVATOR_SCRIPT_SHORT: ScriptOut = {
  title: "Aufzugseil reißt – und dann?",
  hookType: "QUESTION",
  sections: [
    { kind: "HOOK", narration: "Was passiert, wenn das Seil eines Aufzugs reißt? Die Antwort überrascht: fast nichts.", claimIndexes: [0], targetSeconds: 5, visualIntent: "Nahaufnahme eines Stahlseils, das über eine Treibscheibe läuft, ein Draht bricht in Zeitlupe" },
    { kind: "SETUP", narration: "Denn ein Aufzug hängt nie an einem Seil. Er hängt an mehreren, meist drei bis acht. Jedes einzelne trägt die volle Kabine – mit mindestens zwölffacher Sicherheit.", claimIndexes: [0, 1], targetSeconds: 9, visualIntent: "X-Ray-Ansicht des Schachts: Kabine, mehrere parallele Seile, eines reißt, die anderen halten" },
    { kind: "EXPLANATION", narration: "Und selbst wenn alle reißen: Ein Geschwindigkeitsbegrenzer merkt, dass die Kabine zu schnell wird. Er löst rein mechanisch die Fangvorrichtung aus.", claimIndexes: [2], targetSeconds: 8, visualIntent: "Querschnitt: Begrenzer-Seilrad schlägt an, Hebel kippt, Bremskeile fahren aus" },
    { kind: "EXPLANATION", narration: "Stahlkeile pressen sich gegen die Führungsschienen. Die Kabine bremst innerhalb weniger Meter ab. Ganz ohne Strom.", claimIndexes: [2], targetSeconds: 7, visualIntent: "Makro: Bremskeil greift in die Schiene, Funken, Kabine kommt zum Stehen" },
    { kind: "PAYOFF", narration: "Genau das zeigte Elisha Otis schon 1854 – er ließ vor Publikum das Seil kappen. Und blieb stehen. Unten warten außerdem Puffer, die den Rest abfangen.", claimIndexes: [3, 4], targetSeconds: 9, visualIntent: "Historische Szene 1854 als Illustration, dann Puffer am Schachtboden" },
    { kind: "CTA", narration: "Mehr unsichtbare Technik? Folgen.", claimIndexes: [], targetSeconds: 3, visualIntent: "Kanal-Endcard mit Schacht-Silhouette" },
  ],
  styleNotes: "Kurze Sätze, Zahlen konkret, Payoff mit historischem Bild.",
};

export const ELEVATOR_STORYBOARD_SHORT: StoryboardOut = {
  visualStyle: "cinematic technical x-ray / cross-section, dark background, teal and amber accents",
  colorPalette: ["#0B1220", "#19C6D1", "#FFB347", "#FFFFFF"],
  scenes: [
    { sectionIndex: 0, narration: "Was passiert, wenn das Seil eines Aufzugs reißt?", visualDescription: "Extreme Nahaufnahme eines Stahldrahtseils auf einer Treibscheibe, ein einzelner Draht bricht in Zeitlupe", generationPrompt: "Extreme macro shot of a steel wire rope running over an elevator traction sheave, one strand snapping in slow motion, dark industrial background, teal rim light, amber sparks, cinematic, hyper-detailed", negativePrompt: "text, watermark, people, logo, blurry", method: "IMAGE_KENBURNS", camera: "push_in", transitionIn: "cut", soundDesign: "metallic creak, tension drone", overlayText: "", overlayStyle: "none", visualStyleTag: "macro", infographic: null },
    { sectionIndex: 0, narration: "Die Antwort überrascht: fast nichts.", visualDescription: "X-Ray-Ansicht einer Aufzugkabine im Schacht, ruhig hängend", generationPrompt: "X-ray style cross-section of an elevator car hanging in a shaft, glowing outlines, multiple cables above, dark background, teal and amber, technical illustration, cinematic", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "static", transitionIn: "dissolve", soundDesign: "soft whoosh", overlayText: "fast nichts", overlayStyle: "title", visualStyleTag: "xray", infographic: null },
    { sectionIndex: 1, narration: "Denn ein Aufzug hängt nie an einem Seil. Er hängt an mehreren, meist drei bis acht.", visualDescription: "Blick von oben auf die Kabine: 6 parallele Tragseile, eines gerissen, die anderen tragen", generationPrompt: "Top-down x-ray view of an elevator car suspended by six parallel steel cables, one cable snapped and frayed, the others taut and glowing teal, dark shaft, cinematic technical render", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "pull_out", transitionIn: "cut", soundDesign: "cable twang", overlayText: "3–8 Seile", overlayStyle: "stat", visualStyleTag: "cross_section", infographic: null },
    { sectionIndex: 1, narration: "Jedes einzelne trägt die volle Kabine – mit mindestens zwölffacher Sicherheit.", visualDescription: "Infografik: Sicherheitsfaktor 12x", generationPrompt: "", negativePrompt: "", method: "INFOGRAPHIC", camera: "static", transitionIn: "wipeleft", soundDesign: "ui tick", overlayText: "", overlayStyle: "none", visualStyleTag: "diagram", infographic: { title: "Sicherheitsfaktor je Seil", value: "≥ 12×", label: "gefordert durch EN 81" } },
    { sectionIndex: 2, narration: "Und selbst wenn alle reißen: Ein Geschwindigkeitsbegrenzer merkt, dass die Kabine zu schnell wird.", visualDescription: "Querschnitt Maschinenraum: Begrenzer-Seilrad mit Fliehkraftpendel schlägt an", generationPrompt: "Cross-section of an elevator overspeed governor: a pulley with centrifugal flyweights swinging outward and catching a latch, mechanical detail, dark background, teal outlines, amber highlight, cinematic technical illustration", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "push_in", transitionIn: "cut", soundDesign: "ratchet click", overlayText: "", overlayStyle: "none", visualStyleTag: "cross_section", infographic: null },
    { sectionIndex: 2, narration: "Er löst rein mechanisch die Fangvorrichtung aus.", visualDescription: "Hebel kippt, Bremskeile unter der Kabine fahren aus", generationPrompt: "Mechanical safety gear under an elevator car engaging: a lever flips and steel wedges slide outward toward the guide rail, x-ray cutaway, dramatic teal and amber lighting, cinematic", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "pan_right", transitionIn: "dissolve", soundDesign: "heavy clunk", overlayText: "ohne Strom", overlayStyle: "label", visualStyleTag: "simulation", infographic: null },
    { sectionIndex: 3, narration: "Stahlkeile pressen sich gegen die Führungsschienen. Die Kabine bremst innerhalb weniger Meter ab. Ganz ohne Strom.", visualDescription: "Makro: Bremskeil greift in die Schiene, Funken, Kabine kommt zum Stehen", generationPrompt: "Macro shot of a hardened steel brake wedge biting into an elevator guide rail with a burst of amber sparks, motion blur fading to stillness, dark shaft, cinematic, hyper-detailed", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "pull_out", transitionIn: "cut", soundDesign: "screech, then silence", overlayText: "", overlayStyle: "none", visualStyleTag: "macro", infographic: null },
    { sectionIndex: 4, narration: "Genau das zeigte Elisha Otis schon 1854 – er ließ vor Publikum das Seil kappen. Und blieb stehen.", visualDescription: "Illustration im Stich-Stil: Ausstellungshalle 1854, Plattform hängt an Seil, das durchtrennt wird", generationPrompt: "19th century engraving style illustration of a demonstration platform in a grand exhibition hall, a rope above it being cut with an axe, platform held by a safety mechanism, sepia tones with subtle teal accent, no faces visible, no text", negativePrompt: "text, watermark, logo, modern objects, readable faces", method: "IMAGE_KENBURNS", camera: "push_in", transitionIn: "fade", soundDesign: "crowd murmur, rope snap", overlayText: "1854", overlayStyle: "stat", visualStyleTag: "cinematic", infographic: null },
    { sectionIndex: 4, narration: "Unten warten außerdem Puffer, die den Rest abfangen.", visualDescription: "Schachtboden mit zwei Hydraulikpuffern, Kabine setzt sanft auf", generationPrompt: "Cutaway of an elevator pit with two hydraulic buffers compressing as a car settles onto them, x-ray technical look, dark background, teal outlines, amber accents, cinematic", negativePrompt: "text, watermark, people, logo", method: "IMAGE_KENBURNS", camera: "static", transitionIn: "dissolve", soundDesign: "hydraulic hiss", overlayText: "", overlayStyle: "none", visualStyleTag: "cross_section", infographic: null },
    { sectionIndex: 5, narration: "Mehr unsichtbare Technik? Folgen.", visualDescription: "Endcard: Schacht-Silhouette, Kanal-Farben", generationPrompt: "", negativePrompt: "", method: "TEXT_CARD", camera: "static", transitionIn: "fade", soundDesign: "soft chime", overlayText: "", overlayStyle: "none", visualStyleTag: "text", infographic: { title: "Was passiert, wenn …?", value: "Folgen", label: "Jede Woche unsichtbare Technik sichtbar gemacht" } },
  ],
};

export const ELEVATOR_METADATA_SHORT: MetadataOut = {
  titleCandidates: ["Aufzugseil reißt – was dann passiert #Shorts", "Warum ein Aufzug nie abstürzt #Shorts", "Das unsichtbare Sicherheitsnetz im Aufzug #Shorts", "Seil gerissen. Kabine steht. Warum? #Shorts", "Otis 1854: Der Trick, der Aufzüge sicher macht #Shorts"],
  selectedTitleIndex: 1,
  description: "Was passiert, wenn das Seil eines Aufzugs reißt? Fast nichts – und das ist kein Zufall.\n\nAufzüge hängen an mehreren Tragseilen, jedes mit hohem Sicherheitsfaktor. Fällt trotzdem alles aus, löst ein Geschwindigkeitsbegrenzer rein mechanisch die Fangvorrichtung aus, die die Kabine an den Führungsschienen stoppt. Unten fangen Puffer den Rest ab. Elisha Otis hat das Prinzip 1854 öffentlich bewiesen.",
  tags: ["Aufzug", "Fahrstuhl", "Aufzugseil", "Fangvorrichtung", "Otis", "Technik erklärt", "Was passiert wenn", "Physik", "Ingenieurwesen", "Sicherheit", "Shorts", "Visual Science"],
  thumbnailHeadline: "SEIL GERISSEN",
  thumbnailVariant: "left_text",
};
