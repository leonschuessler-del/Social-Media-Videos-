# 06 – Datenmodell & Workflow-State-Machine

## Tabellen (PostgreSQL, Drizzle – `packages/db/src/schema.ts`)

| Tabelle | Zweck | Wichtige Felder |
|---|---|---|
| projects | Projekt/Kanal-Marke | slug, niche, language, reviewMode (SAFE/SEMI_AUTO/FULL_AUTO), maxVideosPerDay, autoApproveThreshold, minPublishScore, styleGuide (JSON), rulesVersion |
| channels | Plattform-Kanal je Projekt | platform, externalChannelId, credentialsRef (→ secrets), defaultPrivacy, defaultPublishHourLocal, timezone |
| secrets | verschlüsselte Tokens | ref, ciphertext, iv, tag |
| topics | Ideen | title, angle, format, source (manual/discovery/repurpose), factors (10 Faktoren), score, status, originalityCheck, tags |
| research_docs | Recherche (versioniert: Fact-Check erzeugt neue Zeile) | summary, keyFacts, claims[{text, sourceIds, verdict, confidence}], sources[{url, sourceType, reliability}], riskFlags |
| scripts | Skript (version) | title, hookType, sections[{kind, narration, claimIds, targetSeconds, visualIntent}], fullNarration, wordCount |
| storyboards | Szenen | aspect, scenes[{index, narration, generationPrompt, method, camera, transitionIn, overlay, visualStyleTag, assetIds}] |
| assets | Asset-Library | kind (image/video/audio_voice/audio_music/audio_sfx/subtitle/thumbnail/render/infographic), storageKey, provider, model, prompt, promptHash, rights{source, license, attributionRequired}, usedInVideoIds, tags |
| videos | Produktionseinheit | stage, status, stageAttempt, research/script/storyboard/render/thumbnail/qaReport-IDs, metadata, experiment, qualityScore, costEur, statusReason, resumeAfter, externalVideoId, scheduledFor, publishedAt, parentVideoId (Repurposing) |
| qa_reports | QA | checks[{check, passed, severity, score, details, automation}], score{8 Faktoren, total}, decision, reasons |
| cost_entries | Usage/Kosten-Ledger | provider, model, capability, units, unitType, costUsd, costEur, coveredByQuota, failed, retry, requestId |
| analytics_snapshots | KPIs je Video/Zeitpunkt | metrics (views, watchTime, AVD, APV, subs, likes, shares, revenue, rpm, retentionCurve …) |
| review_decisions | menschliche Entscheidungen | reviewer, decision, targetStage, notes |
| audit_log | alles Nachvollziehbare | actor, action, entityType, entityId, details |
| rule_versions | versionierte Produktionsregeln | version, rules, rationale, evidence, active |
| capacity_windows | Limit-Fenster | key, maxPerWindow, windowSeconds, used, blockedUntil |

## Experiment-Attribute (je Video, `videos.experiment`)

topicId, hookType, titleVariant, thumbnailVariant, scriptStyle, visualStyle, voiceId, durationSec, publishedAt, channelId, language, generationModels, generationCostEur → verknüpft über `videoId` mit `analytics_snapshots` (Views, AVD, APV, Retention, Subs, Revenue, RPM). Auswertungen (z. B. „X-Ray-Visualisierungen +23 % Retention“) nur ab Mindeststichprobe (Regel: n ≥ 30 je Gruppe, definiert in der Lernschleife, Phase 3).

## Stufen (Stage) und Ausführungsstatus (RunStatus)

```
IDEA → SCORED → SELECTED → RESEARCH → FACT_CHECK → SCRIPT → STORYBOARD → ASSETS → VOICE → EDIT → QA
     → REVIEW (SAFE / unsicher)  ─APPROVE─▶ READY → SCHEDULED → PUBLISHED → ANALYTICS → ARCHIVED
     → READY (SEMI_AUTO ≥ Threshold, FULL_AUTO)
Rücksprünge (QA/REVIEW): → SCRIPT | STORYBOARD | ASSETS | EDIT (REGENERATE/FIX)
```

RunStatus: `QUEUED | RUNNING | DONE | FAILED | WAITING_FOR_CAPACITY | PAUSED | REJECTED | DEAD_LETTER`

| Ereignis | Wirkung |
|---|---|
| Stufe erfolgreich | stage = nächste, status = QUEUED, stageAttempt = 0 |
| retryable Fehler | status = FAILED, Retry (Backoff) bis `MAX_STAGE_ATTEMPTS[stage]` → DEAD_LETTER |
| CapacityExhausted (429/Quota/Scale-Gate) | status = WAITING_FOR_CAPACITY, resumeAfter; Cron plant neu; **kein Providerwechsel** |
| BudgetExceeded | status = PAUSED (Mensch) |
| Kill Switch | keine Ausführung |
| QA REJECT (Policy/Rights critical) | REVIEW + REJECTED |
| QA REGENERATE/FIX | zurück zu ASSETS/SCRIPT/EDIT |
| Review APPROVE | READY → Upload/Schedule |

## Review-Modi

| Modus | Verhalten nach QA PASS |
|---|---|
| SAFE (V1-Start) | immer REVIEW |
| SEMI_AUTO | Score ≥ autoApproveThreshold → READY, sonst REVIEW; nie unter minPublishScore |
| FULL_AUTO | READY; Ausnahmen (QA REVIEW/FIX/REJECT, Score < minPublishScore) → REVIEW |
