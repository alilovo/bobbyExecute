/**
 * M10: Metrics - histograms, p95 approximation.
 */
const buckets: Record<string, number[]> = {};

export function recordLatency(name: string, ms: number): void {
  if (!buckets[name]) buckets[name] = [];
  buckets[name].push(ms);
  if (buckets[name].length > 1000) buckets[name].shift();
}

export function getP95(name: string): number | undefined {
  const arr = buckets[name];
  if (!arr || arr.length === 0) return undefined;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(arr.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}
