import type { Env, Logger, ProviderRegistry, Store } from "@content-os/core";
import { AIRouter, BudgetGuard, CapacityManager, MemoryCapacityStore, ROUTING_V1, UsageManager, enabledProviders, logger as baseLogger } from "@content-os/core";

export interface PipelineContext {
  env: Env;
  store: Store;
  registry: ProviderRegistry;
  router: AIRouter;
  usage: UsageManager;
  budget: BudgetGuard;
  capacity: CapacityManager;
  logger: Logger;
  /** Kill Switch (aus Env oder Laufzeit) */
  isKilled: () => boolean;
}

export function createContext(input: { env: Env; store: Store; registry: ProviderRegistry; logger?: Logger; capacity?: CapacityManager }): PipelineContext {
  const { env, store, registry } = input;
  const router = new AIRouter(ROUTING_V1, enabledProviders(env), env.PROVIDER_MODE);
  const usage = new UsageManager(store.costs, env.USD_EUR_RATE);
  const budget = new BudgetGuard({ perVideoEur: { SHORT: env.BUDGET_PER_VIDEO_SHORT_EUR, LONGFORM: env.BUDGET_PER_VIDEO_LONGFORM_EUR }, dailyEur: env.BUDGET_DAILY_EUR, monthlyEur: env.BUDGET_MONTHLY_EUR }, store.costs);
  const capacity = input.capacity ?? new CapacityManager(new MemoryCapacityStore(), {
    "openai:image.generate": { maxPerWindow: 50, windowSeconds: 60 },
    "openai:llm": { maxPerWindow: 200, windowSeconds: 60 },
    "openai:tts": { maxPerWindow: 30, windowSeconds: 60 },
  });
  return { env, store, registry, router, usage, budget, capacity, logger: input.logger ?? baseLogger, isKilled: () => env.KILL_SWITCH || process.env.KILL_SWITCH === "true" };
}
