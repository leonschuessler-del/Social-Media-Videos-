/**
 * Leichtgewichtige, deterministische Ähnlichkeitsmaße (ohne externe Modelle) für den Originalitäts-Check.
 * Für V1 ausreichend; später optional Embeddings.
 */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function shingles(s: string, k = 3): Set<string> {
  const words = normalizeText(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  if (words.length < k) { if (words.length) out.add(words.join(" ")); return out; }
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function textSimilarity(a: string, b: string, k = 3): number {
  return jaccard(shingles(a, k), shingles(b, k));
}

/** Titel/Hook: kürzere Texte => Bigramm-Jaccard + Wortmengen-Jaccard gemischt. */
export function shortTextSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeText(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeText(b).split(" ").filter(Boolean));
  return 0.5 * jaccard(wa, wb) + 0.5 * textSimilarity(a, b, 2);
}

/** Szenenstruktur: Sequenz der visualStyleTags/methods vergleichen (LCS-Ratio). */
export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  return (2 * dp[a.length]![b.length]!) / (a.length + b.length);
}

export const ORIGINALITY_THRESHOLDS = {
  title: 0.6,
  hook: 0.6,
  script: 0.35,
  sceneStructure: 0.85,
};
