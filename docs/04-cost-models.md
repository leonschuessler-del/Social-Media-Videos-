# 04 – Kostenmodelle

Alle Preise USD laut offizieller OpenAI-Preisseite (Stand 2026-09-24), Umrechnung 0,92 €/$ (konfigurierbar `USD_EUR_RATE`). Kosten werden **pro Call im Ledger** (`cost_entries`) gebucht; die Tabelle hier ist die Planungsgrundlage. Positionen mit ~ sind Schätzungen (Token-Mengen), Preise selbst sind belegt.

## Annahmen je Video

| Größe | Short (≈40 s, 9:16) | Longform (≈10 min, 16:9) |
|---|---|---|
| Szenen | 8–10 | 55–70 |
| Bilder (inkl. 1 Retry-Reserve) | 10 | 70 |
| Infografiken/Textkarten (lokal, 0 $) | 2 | 10 |
| Narration | ~110 Wörter / 700 Zeichen | ~1.500 Wörter / 9.500 Zeichen |
| LLM-Text gesamt (Research+FactCheck+Script+Storyboard+QA+Metadata) | ~40k In / 12k Out Tokens | ~120k In / 45k Out Tokens |
| Web-Search-Calls | 4 | 10 |
| Vision-QA Frames | 6 | 12 |
| STT (whisper-1) | 0,7 min | 10 min |

## Modell A – MVP / günstig (gpt-6-luna überall, Bilder low/medium mix, keine KI-Videos)

| Position | Short | Longform |
|---|---|---|
| Text (luna 0,10 $/0,50 $ per 1M) | 0,004 + 0,006 = **0,010 $** | 0,012 + 0,023 = **0,035 $** |
| Web-Search (10 $/1k) | 0,04 $ | 0,10 $ |
| Bilder (gpt-image-2.5 low ~0,004 $ + 30 % medium ~0,04 $) | 10 × ~0,015 = 0,15 $ | 70 × ~0,015 = 1,05 $ |
| TTS gpt-4o-mini-tts (~0,015 $/min) | 0,01 $ | 0,15 $ |
| STT whisper-1 (0,006 $/min) | 0,004 $ | 0,06 $ |
| Vision-QA (Bild-Input-Tokens, luna) | 0,005 $ | 0,01 $ |
| Render/Storage (lokal/R2) | ~0,00 $ | ~0,01 $ |
| **Summe** | **≈ 0,22 $ ≈ 0,20 €** | **≈ 1,41 $ ≈ 1,30 €** |

## Modell B – Quality (gpt-6-sol für Research/Script/Storyboard/FactCheck, luna für Rest; Bilder medium, Hero-Bilder high)

| Position | Short | Longform |
|---|---|---|
| Text (sol 2 $/10 $ für ~60 % der Tokens, Rest luna) | 0,05 + 0,08 = **0,13 $** | 0,15 + 0,28 = **0,43 $** |
| Web-Search | 0,04 $ | 0,10 $ |
| Bilder (8 × medium 0,04 $ + 2 × high 0,17 $) | 0,66 $ | 60 × 0,04 + 10 × 0,17 = 4,10 $ |
| TTS / STT | 0,015 $ | 0,21 $ |
| Vision-QA (sol) | 0,03 $ | 0,08 $ |
| **Summe** | **≈ 0,88 $ ≈ 0,80 €** | **≈ 4,9 $ ≈ 4,50 €** |

## Modell C – Scale (wie B, plus Batch-API −50 % für nicht-zeitkritische Text-Jobs, Asset-Reuse ~20 %, gpt-6-astra nur für Fact-Check bei hohem Risiko)

| Position | Short | Longform |
|---|---|---|
| Text (Batch −50 %) | 0,07 $ | 0,25 $ |
| Fact-Check-Eskalation (astra, 10 % der Videos, ~0,50 $) | 0,05 $ | 0,05 $ |
| Bilder (−20 % Reuse) | 0,53 $ | 3,30 $ |
| Audio/QA | 0,05 $ | 0,30 $ |
| **Summe** | **≈ 0,70 $ ≈ 0,65 €** | **≈ 3,9 $ ≈ 3,60 €** |

## Hochrechnung (Mix 70 % Shorts / 30 % Longform)

| Menge | MVP | Quality | Scale |
|---|---|---|---|
| 1 Short | 0,20 € | 0,80 € | 0,65 € |
| 1 Longform | 1,30 € | 4,50 € | 3,60 € |
| 100 Videos (70 S / 30 L) | 14 + 39 = **≈ 53 €** | 56 + 135 = **≈ 191 €** | 46 + 108 = **≈ 154 €** |
| 1.000 Videos | **≈ 530 €** | **≈ 1.910 €** | **≈ 1.540 €** |

Hinzu kommen Fixkosten: Hosting (VPS 4 vCPU/8 GB für Worker+API ≈ 20–40 €/Monat), Storage R2 (≈ 0,015 $/GB), Domain, ggf. Musiklizenz-Abo (z. B. Epidemic/Artlist ≈ 10–20 €/Monat, Freigabe nötig) und optional OpenAI-Tier-Vorauszahlung.

## Wahrscheinlich teuerste Komponenten

1. **Bilder** (60–85 % der variablen Kosten) – Hebel: low-Quality für B-Roll, Reuse-Library, weniger Szenen pro Minute bei Longform (8–10 s statt 5 s).
2. **Premium-Text-Modell** (Script/Fact-Check) – Hebel: sol statt astra, Batch-API.
3. **Wenn extern freigegeben: KI-Video** – würde alles dominieren (Beispiel: 10 Hero-Clips à 8 s bei ~0,10–0,50 $/s = 8–40 $/Longform). Deshalb standardmäßig aus.

## Was NICHT anfällt

- Render (FFmpeg): 0 $ – nur CPU-Zeit (Short ≈ 1–2 min, Longform ≈ 15–30 min auf 4 vCPU).
- Moderation: kostenlos.
- YouTube Data/Analytics API: kostenlos (Quota-begrenzt).
