/**
 * Limit-aware Scheduling: Kapazität pro Provider/Capability als Token-Bucket.
 * Wird ein offizielles Limit (429 / Quota) gemeldet, wird der Bucket bis `retryAfter` gesperrt.
 * Jobs gehen dann in WAITING_FOR_CAPACITY statt auf einen Fremdanbieter zu wechseln.
 */
export interface CapacityWindow {
  key: string; // z.B. "openai:video.generate"
  maxPerWindow: number;
  windowSeconds: number;
  used: number;
  windowStart: number; // epoch ms
  blockedUntil?: number; // epoch ms
}

export interface CapacityStore {
  get(key: string): Promise<CapacityWindow | undefined>;
  set(win: CapacityWindow): Promise<void>;
}

export class MemoryCapacityStore implements CapacityStore {
  private m = new Map<string, CapacityWindow>();
  async get(key: string) { return this.m.get(key); }
  async set(win: CapacityWindow) { this.m.set(win.key, win); }
}

export interface CapacityDecision {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export class CapacityManager {
  constructor(private readonly store: CapacityStore, private readonly defaults: Record<string, { maxPerWindow: number; windowSeconds: number }> = {}) {}

  private async load(key: string, now: number): Promise<CapacityWindow> {
    let w = await this.store.get(key);
    const d = this.defaults[key] ?? { maxPerWindow: Number.MAX_SAFE_INTEGER, windowSeconds: 60 };
    if (!w) w = { key, maxPerWindow: d.maxPerWindow, windowSeconds: d.windowSeconds, used: 0, windowStart: now };
    if (now - w.windowStart >= w.windowSeconds * 1000) { w.used = 0; w.windowStart = now; }
    return w;
  }

  async check(key: string, units = 1, now = Date.now()): Promise<CapacityDecision> {
    const w = await this.load(key, now);
    if (w.blockedUntil && w.blockedUntil > now) {
      return { allowed: false, reason: `Limit gemeldet für ${key}`, retryAfterSeconds: Math.ceil((w.blockedUntil - now) / 1000) };
    }
    if (w.used + units > w.maxPerWindow) {
      const retry = Math.ceil((w.windowStart + w.windowSeconds * 1000 - now) / 1000);
      return { allowed: false, reason: `Fenster-Limit ${w.maxPerWindow}/${w.windowSeconds}s erreicht für ${key}`, retryAfterSeconds: Math.max(1, retry) };
    }
    return { allowed: true };
  }

  async consume(key: string, units = 1, now = Date.now()): Promise<void> {
    const w = await this.load(key, now);
    w.used += units;
    await this.store.set(w);
  }

  /** Vom Provider gemeldetes Limit (429, insufficient_quota). */
  async reportLimit(key: string, retryAfterSeconds: number, now = Date.now()): Promise<void> {
    const w = await this.load(key, now);
    w.blockedUntil = now + Math.max(5, retryAfterSeconds) * 1000;
    await this.store.set(w);
  }
}
