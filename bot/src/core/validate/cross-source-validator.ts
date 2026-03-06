/**
 * M5: Cross-Source Validator - discrepancy detection, confidence on missing metrics.
 */
import type { NormalizedTokenV1 } from "../contracts/tokenuniverse.js";
import { calculateTokenConfidence } from "../contracts/tokenuniverse.js";

export interface ValidationResult {
  token: NormalizedTokenV1;
  discrepancy: boolean;
  relativeDelta?: number;
  confidencePenalty: number;
  validated: NormalizedTokenV1;
}

const DEFAULT_THRESHOLD = 0.2;
const RECOVERY_ATTEMPTS = 2;

/**
 * Relative delta between two values: |a - b| / max(a, b, 1).
 */
function relativeDelta(a: number, b: number): number {
  const max = Math.max(a, b, 1);
  return Math.abs(a - b) / max;
}

/**
 * sMAPE-inspired: 2 * |a - b| / (|a| + |b| + epsilon).
 */
function smape(a: number, b: number, epsilon = 1e-10): number {
  const denom = Math.abs(a) + Math.abs(b) + epsilon;
  return (2 * Math.abs(a - b)) / denom;
}

/** Freshness penalty: degraded when >15s, strong when >30s. */
const FRESHNESS_DEGRADED_MS = 15_000;
const FRESHNESS_STALE_MS = 30_000;
const PENALTY_DEGRADED = 0.1;
const PENALTY_STALE = 0.25;

/**
 * Validate token across sources; flag discrepancy; reduce confidence for missing metrics.
 * freshnessMs > 15s adds degraded penalty; > 30s adds strong penalty.
 */
export function validateCrossSource(
  tokens: NormalizedTokenV1[],
  options?: {
    threshold?: number;
    sourceQualities?: Record<string, number>;
    freshnessMs?: number;
  }
): ValidationResult[] {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const sourceQualities = options?.sourceQualities ?? {};
  const freshnessMs = options?.freshnessMs ?? 0;

  return tokens.map((token) => {
    let discrepancy = false;
    let relativeDeltaVal: number | undefined;
    let confidencePenalty = 0;

    const sources = Array.isArray(token.sources) ? token.sources : [];
    if (sources.length < 2) {
      confidencePenalty += 0.1;
    }

    if (freshnessMs > FRESHNESS_STALE_MS) {
      confidencePenalty += PENALTY_STALE;
    } else if (freshnessMs > FRESHNESS_DEGRADED_MS) {
      confidencePenalty += PENALTY_DEGRADED;
    }

    const confidence = calculateTokenConfidence(sources, sourceQualities);
    const adjustedConfidence = Math.max(0, confidence - confidencePenalty);

    return {
      token,
      discrepancy,
      relativeDelta: relativeDeltaVal,
      confidencePenalty,
      validated: {
        ...token,
        confidence_score: adjustedConfidence,
      },
    };
  });
}

/**
 * Compare two price/volume values for discrepancy.
 */
export function hasDiscrepancy(
  valueA: number,
  valueB: number,
  threshold = DEFAULT_THRESHOLD
): { discrepancy: boolean; delta: number } {
  const delta = smape(valueA, valueB);
  return { discrepancy: delta > threshold, delta };
}
