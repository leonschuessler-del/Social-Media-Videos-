# 12 – Erstes Testvideo-Konzept

## Themenwahl: „Was passiert, wenn ein Aufzugseil reißt?“

| Kriterium | Bewertung |
|---|---|
| Visuell stark | Stahlseil-Makro, X-Ray-Schacht, Fangvorrichtung im Querschnitt, Funken an der Schiene, historische Otis-Szene, Puffer – 6+ klar unterschiedliche Bilder |
| Hook | Frage + Gegenintuition („fast nichts“) in Sekunde 1–3 |
| Faktisch sauber | Normenwissen (EN 81-20/50), Herstellerdoku (Otis), Prüforganisationen (TÜV) – keine umstrittenen Zahlen nötig; Seilanzahl als Bereich |
| Nicht medizinisch | Reine Technik; Risiko-Flag verhindert Notfall-Verhaltensanweisungen |
| Mehrere Szenen | Short: 10 Szenen; Longform: ~16 Szenen im Prototyp (real ~60) |
| Evergreen / Suchinteresse | zeitlos, häufige Alltagsfrage, gutes Repurposing (Longform → Shorts: „12-fache Sicherheit“, „Otis 1854“, „Fangvorrichtung“) |

## Short (≈ 45–55 s, 9:16)

Hook → 3–8 Seile (Stat-Overlay) → Infografik „≥ 12×“ → Begrenzer → Fangvorrichtung („ohne Strom“) → Bremskeil/Funken → Otis 1854 (Stat-Overlay) → Puffer → Endcard. Wort-Highlight-Captions, Ducking-Musik, SFX aus Bibliothek (falls vorhanden).

Skript, Storyboard, Research und Metadaten: `packages/pipeline/src/fixtures/elevator.ts` (Mock-Fixture; live erzeugt das LLM eigene Inhalte mit Websuche).

## Longform-Prototyp (Mock: ~2,5 min; Ziel live: 8–10 min, 16:9)

Struktur: Hook → Gesamtsystem (Waage/Gegengewicht) → Treibscheibe/Reibung → Bremse bei Stromausfall → Realitätscheck (Pattern Interrupt) → Begrenzer → Sperrfang vs. Gleitfang → Otis → Puffer → Ebenen-Übersicht → Outro/Teaser. Chapters werden aus Sektionen erzeugt, 3 Thumbnail-Varianten („SEIL GERISSEN“).

Start: `pnpm cli produce --format LONGFORM --memory`.

## Erwartete Kosten (live, Modell B „Quality“)

Short ≈ 0,80 €, Longform ≈ 4,50 € (siehe 04). Im Mock: 0 €.
