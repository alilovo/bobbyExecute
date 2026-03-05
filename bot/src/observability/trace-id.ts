/**
 * Deterministic Trace ID - Production Readiness M1.
 * Replaces Math.random-based IDs for replay compatibility.
 * Same (timestamp, seed) → same traceId when seed provided.
 */
import { sha256 } from "../core/determinism/hash.js";
import { canonicalize } from "../core/determinism/canonicalize.js";
import crypto from "node:crypto";

/**
 * Create a trace ID. Deterministic when seed is provided (replay mode).
 * @param opts.timestamp - ISO timestamp (e.g. from clock)
 * @param opts.seed - Optional. When provided, same (timestamp, seed) → same traceId
 * @param opts.prefix - Optional. Default "trace"
 */
export function createTraceId(opts: {
  timestamp: string;
  seed?: unknown;
  prefix?: string;
}): string {
  const { timestamp, seed, prefix = "trace" } = opts;
  const bucket = timestamp.slice(0, 16).replace(/[:.]/g, "-");

  let suffix: string;
  if (seed !== undefined) {
    const raw = canonicalize({ bucket, seed });
    suffix = sha256(raw).slice(0, 9);
  } else {
    suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 9);
  }

  return `${prefix}-${bucket}-${suffix}`;
}

/**
 * Create a deterministic child trace ID for MemoryDB snapshots.
 * Same (parentTraceId, dataQuality) → same id.
 */
export function createMemoryTraceId(
  parentTraceId: string,
  dataQuality: { completeness: number; freshness: number }
): string {
  const raw = canonicalize({ parent: parentTraceId, dq: dataQuality });
  const suffix = sha256(raw).slice(0, 6);
  return `${parentTraceId}-mem-${suffix}`;
}
