/**
 * Trace/correlation for audit trails.
 * M1: Delegates to trace-id.createTraceId (deterministic when seed provided).
 */
import { createTraceId as createTraceIdImpl } from "./trace-id.js";

/**
 * Create a trace ID. For replay/determinism, use trace-id.createTraceId with seed.
 */
export function createTraceId(): string {
  return createTraceIdImpl({
    timestamp: new Date().toISOString(),
  });
}

export { createTraceId as createTraceIdDeterministic, createMemoryTraceId } from "./trace-id.js";
