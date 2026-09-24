export type ErrorKind =
  | "VALIDATION"
  | "PROVIDER_DISABLED"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "CAPACITY_EXHAUSTED"
  | "BUDGET_EXCEEDED"
  | "BLOCKED_BY_PROVIDER"
  | "KILL_SWITCH"
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "QA_FAILED"
  | "RENDER_FAILED"
  | "INTERNAL";

export class ContentOsError extends Error {
  readonly kind: ErrorKind;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;
  constructor(kind: ErrorKind, message: string, opts: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = "ContentOsError";
    this.kind = kind;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details ?? {};
  }
}

export class CapacityExhaustedError extends ContentOsError {
  readonly retryAfterSeconds: number | undefined;
  constructor(provider: string, message: string, retryAfterSeconds?: number) {
    super("CAPACITY_EXHAUSTED", message, { retryable: true, details: { provider, retryAfterSeconds } });
    this.name = "CapacityExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class BudgetExceededError extends ContentOsError {
  constructor(scope: string, limitEur: number, spentEur: number) {
    super("BUDGET_EXCEEDED", `Budget ${scope} überschritten: ${spentEur.toFixed(2)} € von ${limitEur.toFixed(2)} €`, {
      retryable: false,
      details: { scope, limitEur, spentEur },
    });
    this.name = "BudgetExceededError";
  }
}

export class ProviderDisabledError extends ContentOsError {
  constructor(capability: string, provider: string) {
    super("PROVIDER_DISABLED", `Provider "${provider}" für ${capability} ist nicht freigegeben (OpenAI-first Policy).`, {
      details: { capability, provider },
    });
    this.name = "ProviderDisabledError";
  }
}

export class BlockedByProviderError extends ContentOsError {
  constructor(capability: string, reason: string) {
    super("BLOCKED_BY_PROVIDER", `${capability}: BLOCKED_BY_PROVIDER – ${reason}`, { details: { capability, reason } });
    this.name = "BlockedByProviderError";
  }
}

export function isRetryable(err: unknown): boolean {
  return err instanceof ContentOsError ? err.retryable : false;
}
