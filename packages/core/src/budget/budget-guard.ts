import type { VideoFormat } from "../domain.ts";
import { BudgetExceededError } from "../errors.ts";

export interface BudgetLimits {
  perVideoEur: Record<VideoFormat, number>;
  perProjectDailyEur?: number;
  dailyEur: number;
  monthlyEur: number;
  perProviderMonthlyEur?: Record<string, number>;
}

export interface SpendSnapshot {
  videoEur: number;
  projectDailyEur: number;
  dailyEur: number;
  monthlyEur: number;
  providerMonthlyEur: number;
}

/** Quelle für aktuelle Ausgaben (DB-Implementierung in @content-os/db). */
export interface SpendSource {
  snapshot(input: { videoId?: string; projectId?: string; provider: string; now: Date }): Promise<SpendSnapshot>;
}

/**
 * Prüft VOR jedem kostenpflichtigen Call, ob ein Budget überschritten würde.
 * Wirft BudgetExceededError – der Orchestrator setzt den Job auf WAITING_FOR_CAPACITY / PAUSED.
 */
export class BudgetGuard {
  constructor(private readonly limits: BudgetLimits, private readonly spend: SpendSource) {}

  async assertCanSpend(input: {
    estimatedCostEur: number;
    videoId?: string;
    projectId?: string;
    format?: VideoFormat;
    provider: string;
    now?: Date;
  }): Promise<SpendSnapshot> {
    const now = input.now ?? new Date();
    const s = await this.spend.snapshot({ videoId: input.videoId, projectId: input.projectId, provider: input.provider, now });
    const est = Math.max(0, input.estimatedCostEur);

    if (input.videoId && input.format) {
      const lim = this.limits.perVideoEur[input.format];
      if (s.videoEur + est > lim) throw new BudgetExceededError(`video:${input.videoId}`, lim, s.videoEur + est);
    }
    if (input.projectId && this.limits.perProjectDailyEur !== undefined) {
      if (s.projectDailyEur + est > this.limits.perProjectDailyEur)
        throw new BudgetExceededError(`project-daily:${input.projectId}`, this.limits.perProjectDailyEur, s.projectDailyEur + est);
    }
    if (s.dailyEur + est > this.limits.dailyEur) throw new BudgetExceededError("daily", this.limits.dailyEur, s.dailyEur + est);
    if (s.monthlyEur + est > this.limits.monthlyEur) throw new BudgetExceededError("monthly", this.limits.monthlyEur, s.monthlyEur + est);
    const provLim = this.limits.perProviderMonthlyEur?.[input.provider];
    if (provLim !== undefined && s.providerMonthlyEur + est > provLim)
      throw new BudgetExceededError(`provider-monthly:${input.provider}`, provLim, s.providerMonthlyEur + est);
    return s;
  }
}

/** In-Memory-Implementierung für Tests. */
export class MemorySpendSource implements SpendSource {
  entries: { videoId?: string; projectId?: string; provider: string; costEur: number; at: Date }[] = [];
  add(e: { videoId?: string; projectId?: string; provider: string; costEur: number; at?: Date }) {
    this.entries.push({ ...e, at: e.at ?? new Date() });
  }
  async snapshot(input: { videoId?: string; projectId?: string; provider: string; now: Date }): Promise<SpendSnapshot> {
    const dayStart = new Date(input.now); dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), 1));
    const sum = (pred: (e: (typeof this.entries)[number]) => boolean) => this.entries.filter(pred).reduce((a, e) => a + e.costEur, 0);
    return {
      videoEur: input.videoId ? sum((e) => e.videoId === input.videoId) : 0,
      projectDailyEur: input.projectId ? sum((e) => e.projectId === input.projectId && e.at >= dayStart) : 0,
      dailyEur: sum((e) => e.at >= dayStart),
      monthlyEur: sum((e) => e.at >= monthStart),
      providerMonthlyEur: sum((e) => e.provider === input.provider && e.at >= monthStart),
    };
  }
}
