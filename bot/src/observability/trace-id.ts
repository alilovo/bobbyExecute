/**
 * Deterministic Trace ID - Production Readiness M1.
 * Replaces Math.random-based IDs for replay compatibility.
 * Same (timestamp, seed) → same traceId when seed provided.
 * Spec API: mode + runInputsHash + timestampBucket for explicit replay/live.
 */
import { sha256 } from "../core/determinism/hash.js";
import { canonicalize } from "../core/determinism/canonicalize.js";
import crypto from "node:crypto";

export interface CreateTraceIdOptions {
  /** ISO timestamp (e.g. from clock). Used for bucket when runInputsHash not provided. */
  timestamp?: string;
  /** Seed for deterministic replay. Same (timestamp, seed) → same traceId. */
  seed?: unknown;
  /** Prefix. Default "trace" */
  prefix?: string;
  /** Spec: replay | live. replay = deterministic, live = UUID */
  mode?: "replay" | "live";
  /** Spec: hash of run inputs for replay formula */
  runInputsHash?: string;
  /** Spec: timestamp bucket (e.g. ISO slice). Used with runInputsHash. */
  timestampBucket?: string;
}

/**
 * Create a trace ID. Deterministic when seed or (mode=replay + runInputsHash) provided.
 * @param opts - timestamp, seed, prefix (legacy) or mode, runInputsHash, timestampBucket (spec)
 */
export function createTraceId(opts: CreateTraceIdOptions): string {
  const {
    timestamp = new Date().toISOString(),
    seed,
    prefix = "trace",
    mode,
    runInputsHash,
    timestampBucket,
  } = opts;

  const bucket = timestampBucket ?? timestamp.slice(0, 16).replace(/[:.]/g, "-");

  const useReplay =
    mode === "replay" ||
    (mode !== "live" && (seed !== undefined || (runInputsHash !== undefined && timestampBucket !== undefined)));

  let suffix: string;
  if (useReplay && runInputsHash !== undefined && timestampBucket !== undefined) {
    const raw = `${runInputsHash}${timestampBucket}${seed !== undefined ? canonicalize(seed) : ""}`;
    suffix = sha256(raw).slice(0, 32);
  } else if (useReplay && seed !== undefined) {
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
