/**
 * M1: Deterministic Trace IDs - same input → same traceId when seed provided.
 */
import { describe, expect, it } from "vitest";
import { createTraceId, createMemoryTraceId } from "@bot/observability/trace-id.js";

describe("Trace ID Determinism (M1)", () => {
  const fixedTimestamp = "2026-03-05T12:00:00.000Z";
  const seed = { token: "SOL", amount: "1" };

  it("same timestamp + seed produces same traceId", () => {
    const a = createTraceId({ timestamp: fixedTimestamp, seed });
    const b = createTraceId({ timestamp: fixedTimestamp, seed });
    expect(a).toBe(b);
  });

  it("different seed produces different traceId", () => {
    const a = createTraceId({ timestamp: fixedTimestamp, seed: { a: 1 } });
    const b = createTraceId({ timestamp: fixedTimestamp, seed: { a: 2 } });
    expect(a).not.toBe(b);
  });

  it("different timestamp produces different traceId", () => {
    const a = createTraceId({ timestamp: "2026-03-05T12:00:00.000Z", seed });
    const b = createTraceId({ timestamp: "2026-03-05T12:01:00.000Z", seed });
    expect(a).not.toBe(b);
  });

  it("includes prefix", () => {
    const id = createTraceId({ timestamp: fixedTimestamp, seed, prefix: "orch" });
    expect(id).toMatch(/^orch-/);
  });

  it("createMemoryTraceId is deterministic", () => {
    const parent = "orch-2026-03-05T1200-abc123";
    const dq = { completeness: 0.9, freshness: 0.85 };
    const a = createMemoryTraceId(parent, dq);
    const b = createMemoryTraceId(parent, dq);
    expect(a).toBe(b);
    expect(a).toMatch(/^orch-2026-03-05T1200-abc123-mem-[a-f0-9]{6}$/);
  });

  it("createMemoryTraceId differs for different dataQuality", () => {
    const parent = "orch-2026-03-05T1200-abc123";
    const a = createMemoryTraceId(parent, { completeness: 0.9, freshness: 0.8 });
    const b = createMemoryTraceId(parent, { completeness: 0.8, freshness: 0.9 });
    expect(a).not.toBe(b);
  });
});
