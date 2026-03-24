import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "../../src/core/clock.js";
import { createDecisionCoordinator } from "../../src/core/decision/index.js";

describe("CanonicalDecisionCoordinator", () => {
  it("produces the same envelope for identical inputs", async () => {
    const clock = new FakeClock("2026-03-17T12:00:00.000Z");
    const coordinator = createDecisionCoordinator();
    const handlers = {
      ingest: vi.fn(async () => ({ payload: { ingest: "ok" } })),
      signal: vi.fn(async () => ({ payload: { signal: "ok" } })),
      risk: vi.fn(async () => ({ payload: { risk: "ok" } })),
      execute: vi.fn(async () => ({ payload: { execute: "ok" } })),
      verify: vi.fn(async () => ({ payload: { verify: "ok" } })),
      journal: vi.fn(async () => ({ payload: { journal: "ok" } })),
      monitor: vi.fn(async () => ({ payload: { monitor: "ok" } })),
    } as const;

    const request = {
      entrypoint: "engine" as const,
      flow: "trade" as const,
      clock,
      traceIdSeed: "seed-1",
      tracePrefix: "trace",
      handlers,
    };

    const first = await coordinator.run(request);
    const second = await coordinator.run(request);

    expect(first).toStrictEqual(second);
    expect(first.blocked).toBe(false);
    expect(first.stage).toBe("monitor");
    expect(handlers.ingest).toHaveBeenCalledTimes(2);
    expect(handlers.monitor).toHaveBeenCalledTimes(2);
  });

  it("keeps blocked outcomes stable and explicit", async () => {
    const clock = new FakeClock("2026-03-17T12:00:00.000Z");
    const coordinator = createDecisionCoordinator();

    const envelope = await coordinator.run({
      entrypoint: "live-runtime",
      flow: "trade",
      clock,
      traceIdSeed: "seed-2",
      tracePrefix: "runtime",
      handlers: {
        ingest: async () => ({ payload: { ingest: "ok" } }),
        signal: async () => ({ payload: { signal: "ok" } }),
        risk: async () => ({
          blocked: true,
          blockedReason: "RISK_DENY",
          payload: { allowed: false },
        }),
        execute: async () => ({ payload: { execute: "skipped" } }),
        verify: async () => ({ payload: { verify: "skipped" } }),
        journal: async () => ({ payload: { journal: "skipped" } }),
      },
    });

    expect(envelope.blocked).toBe(true);
    expect(envelope.blockedReason).toBe("RISK_DENY");
    expect(envelope.stage).toBe("risk");
    expect(envelope.decisionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(envelope.resultHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
