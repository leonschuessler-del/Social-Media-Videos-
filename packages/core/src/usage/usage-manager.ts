import type { Capability, CostEntry, Stage } from "../domain.ts";
import { newId } from "../ids.ts";
import { estimateUsd } from "./pricing.ts";

export interface UsageEvent {
  provider: string;
  model: string;
  capability: Capability;
  units: number;
  unitType: CostEntry["unitType"];
  projectId?: string;
  videoId?: string;
  stage?: Stage;
  requestId?: string;
  /** true: fehlgeschlagen (wird gezählt, aber nicht bepreist, außer Provider berechnet es) */
  failed?: boolean;
  retry?: boolean;
  coveredByQuota?: boolean;
  costUsdOverride?: number;
}

export interface UsageSink {
  record(entry: CostEntry & { failed: boolean; retry: boolean }): Promise<void>;
}

export interface UsageSummary {
  textJobs: number;
  images: number;
  videoClips: number;
  videoSeconds: number;
  ttsCharacters: number;
  retries: number;
  failures: number;
  costUsd: number;
  costEur: number;
  coveredByQuotaUsd: number;
}

/**
 * Zentraler Usage Manager: JEDER Provider-Call läuft hier durch.
 * Zählt Generierungen, Retries, Fehler und rechnet Kosten (USD/EUR) über die Preistabelle.
 */
export class UsageManager {
  constructor(private readonly sink: UsageSink, private readonly usdEurRate: number) {}

  async record(ev: UsageEvent): Promise<CostEntry> {
    const est = ev.costUsdOverride !== undefined ? { usd: ev.costUsdOverride, known: true } : estimateUsd(ev.provider, ev.model, ev.unitType, ev.units);
    const costUsd = ev.failed ? 0 : est.usd;
    const entry: CostEntry = {
      id: newId("cost"),
      projectId: ev.projectId,
      videoId: ev.videoId,
      stage: ev.stage,
      provider: ev.provider,
      model: ev.model,
      capability: ev.capability,
      units: ev.units,
      unitType: ev.unitType,
      costUsd: Number(costUsd.toFixed(6)),
      costEur: Number((costUsd * this.usdEurRate).toFixed(6)),
      coveredByQuota: ev.coveredByQuota ?? false,
      requestId: ev.requestId,
      createdAt: new Date().toISOString(),
    };
    await this.sink.record({ ...entry, failed: ev.failed ?? false, retry: ev.retry ?? false });
    return entry;
  }
}

export class MemoryUsageSink implements UsageSink {
  entries: (CostEntry & { failed: boolean; retry: boolean })[] = [];
  async record(entry: CostEntry & { failed: boolean; retry: boolean }) { this.entries.push(entry); }
  summarize(filter: (e: CostEntry) => boolean = () => true): UsageSummary {
    const s: UsageSummary = { textJobs: 0, images: 0, videoClips: 0, videoSeconds: 0, ttsCharacters: 0, retries: 0, failures: 0, costUsd: 0, costEur: 0, coveredByQuotaUsd: 0 };
    for (const e of this.entries.filter(filter)) {
      if (e.capability.startsWith("llm") || e.capability.startsWith("search")) s.textJobs += e.unitType === "requests" ? e.units : 1;
      if (e.capability.startsWith("image")) s.images += e.units;
      if (e.capability.startsWith("video")) { s.videoClips += 1; s.videoSeconds += e.units; }
      if (e.capability === "tts") s.ttsCharacters += e.units;
      if (e.retry) s.retries += 1;
      if (e.failed) s.failures += 1;
      s.costUsd += e.costUsd;
      s.costEur += e.costEur;
      if (e.coveredByQuota) s.coveredByQuotaUsd += e.costUsd;
    }
    return s;
  }
}
