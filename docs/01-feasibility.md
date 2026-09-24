# 01 – Machbarkeitsprüfung

## Kurzfazit

| Dimension | Urteil | Begründung |
|-----------|--------|------------|
| Technisch | **machbar** – mit einer wesentlichen Einschränkung | Text, Recherche (Websuche mit Zitaten), Bild, Bildbearbeitung, TTS, STT, Vision-QA, Moderation sind bei OpenAI offiziell per API automatisierbar. **KI-Videogenerierung ist bei OpenAI nicht mehr verfügbar** (Sora-API am 24.09.2026 abgeschaltet, kein Nachfolger). Musik/SFX gibt es bei OpenAI nicht. Schnitt/Render ist deterministisch (FFmpeg) vollständig automatisierbar. |
| Wirtschaftlich | **machbar**, aber nicht „gratis aus dem Abo“ | ChatGPT-Abo (Plus/Pro/Team) und API sind **getrennte Abrechnungssysteme**. Kein offizieller Weg, Abo-Kontingent programmatisch zu nutzen. Reale Kosten (siehe 04): Short ≈ 0,15–0,60 €, Longform ≈ 1,50–6 € bei bildbasierter Produktion. Das ist wirtschaftlich sehr gut – teuer wäre nur KI-Video (extern, nicht freigegeben). |
| YouTube-Policy | **machbar**, wenn die Pipeline Originalität, Faktenbasis und Disclosure erzwingt | YPP-Regel zu „inauthentic content“ (seit 15.07.2025) zielt auf massenhaft wiederholte/ templatehafte Inhalte. Unser System baut Originalitäts-QA, echte Recherche mit Quellen, unterschiedliche Szenenstrukturen und Synthetic-Media-Kennzeichnung (API-Feld `containsSyntheticMedia`) ein. Risiko bleibt: YouTube entscheidet, nicht wir. |
| Automatisierungsgrad | realistisch **~85–90 %** in Phase 1, **95 %+** erst nach Scale-Gate | Manuell bleiben: Freigabe (SAFE), Google-Cloud-API-Audit, Impressions/CTR-Ablesen (nicht per API), Musiklizenzierung, seltene QA-Eskalationen. |

## Widerspruch zu Annahmen des Master-Prompts (begründet)

1. **„Vorhandene ChatGPT-Nutzung zuerst verwenden“** – Nicht möglich. OpenAI: „ChatGPT and the API platform have separate billing systems. API usage is billed separately from your ChatGPT subscription.“ ChatGPT-Credits gelten für Codex/ChatGPT-Produkte, nicht für die API. Die einzige offiziell „im Abo enthaltene“ programmatische Nutzung ist Codex (Coding-Agent) – dessen Token sind auf Codex-Berechtigungen beschränkt und ausdrücklich nicht als allgemeines LLM-Backend gedacht. Browser-/Session-Automation von ChatGPT verstößt gegen die Nutzungsbedingungen („automatically or programmatically extract data or Output“, „circumvent any rate limits“). **Konsequenz:** Die Content-Produktion läuft über einen OpenAI-API-Account mit Prepaid-Guthaben (min. 5 $). Das ist eine zusätzliche, aber kleine Kostenposition. Freigabe erforderlich (siehe 11).
2. **„Video-Generierung über OpenAI, soweit offiziell verfügbar“** – Seit heute nicht verfügbar. Sora 2 App (26.04.2026) und Videos-API (24.09.2026) sind eingestellt. **Konsequenz:** V1 produziert *bildbasiert* (generierte Stills + Ken Burns + programmatische Animation/Infografiken + Schnitt). Das ist für „X-Ray/Querschnitt/Makro“-Content sehr gut geeignet und drastisch günstiger. Echte KI-Videoclips (Hero-Sequenzen) nur nach Freigabe eines externen Anbieters. Interface, Queue, Mock und Datenmodell sind bereits gebaut.
3. **„Musik und SFX automatisieren“** – OpenAI bietet keine Musik-/SFX-Generierung. **Konsequenz:** Lokale, lizenzierte Bibliothek (z. B. YouTube Audio Library, CC0, gekaufte Lizenzpakete) mit `license.json` je Datei; Fallback ist ein synthetisches Ambient-Pad (eigene Erzeugung). Generative Musik (ElevenLabs Music, Suno, Stable Audio) nur nach Freigabe.
4. **„Impressions & CTR automatisch abrufen“** – Die YouTube Analytics API liefert keine Impressions/Impressions-CTR (nur YouTube Studio). **Konsequenz:** Label MANUAL; Views, Watchtime, AVD, APV, Retention-Kurve, Subs, Revenue/CPM (mit Monetary-Scope) sind automatisiert.
5. **„Dutzende Videos pro Tag“** – Technisch skalierbar (Queue, Budget, Kapazität), aber bewusst durch Scale-Gate (`maxVideosPerDay` je Projekt, Standard 1–3) begrenzt. Qualität × Retention × Revenue pro Generierungseinheit ist die Zielgröße, nicht Menge.
6. **„Remotion“** – Für V1 bewusst FFmpeg-only (deterministisch, keine Chrome-Abhängigkeit, keine Lizenzfrage). Remotion bleibt Option für komplexe animierte Infografiken (ADR-003).

## Größte Risiken

| Risiko | Wahrscheinlichkeit | Wirkung | Gegenmaßnahme |
|--------|--------------------|---------|---------------|
| YouTube stuft Kanal als „inauthentic/mass-produced“ ein | mittel | hoch (Monetarisierung) | Originalitäts-QA, echte Recherche, SAFE-Mode-Start, langsame Skalierung, variierende Struktur/Hooks/Visuals, kein Templating |
| API-Projekt nicht auditiert → Uploads bleiben privat | hoch (initial) | mittel | Google-Cloud-Projekt anlegen, YouTube-API-Compliance-Audit beantragen (MANUAL, Vorlauf Wochen); bis dahin privat/unlisted testen |
| Bildmodell erzeugt sachlich falsche Technik-Details | mittel | mittel | Prompt-Regeln (keine Labels im Bild), programmatische Infografiken für exakte Zahlen, Vision-QA, menschliches Review |
| OpenAI-Limits/Kontingent erschöpft | mittel | niedrig | Limit-aware Scheduling: WAITING_FOR_CAPACITY, kein Fremdanbieter-Fallback ohne Freigabe |
| Kein KI-Video → visuell weniger „wow“ als Konkurrenz | mittel | mittel | Starke Stills + Kamera-Bewegung + Infografiken + Sounddesign; Hero-Clips später optional |
| Modellwechsel/Deprecations (OpenAI räumt Modelle regelmäßig ab) | hoch | niedrig | Modell-IDs zentral im Routing (versioniert), Preistabelle versioniert |
