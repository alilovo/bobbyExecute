import { describe, expect, it } from "vitest";
import { FakeClock } from "../../src/core/clock.js";
import { createDecisionCoordinator } from "../../src/core/decision/index.js";

describe("decision entrypoint equivalence", () => {
  it("keeps canonical hashes stable across entrypoints when handler outputs match", async () => {
    const coordinator = createDecisionCoordinator();
    const clock = new FakeClock("2026-03-17T12:00:00.000Z");

    const runs = await Promise.all(
      [
        { entrypoint: "engine", flow: "trade", prefix: "trace" },
        { entrypoint: "orchestrator", flow: "analysis", prefix: "orch" },
        { entrypoint: "dry-runtime", flow: "trade", prefix: "runtime" },
        { entrypoint: "live-runtime", flow: "trade", prefix: "runtime" },
      ].map((item) =>
        coordinator.run({
          entrypoint: item.entrypoint as "engine" | "orchestrator" | "dry-runtime" | "live-runtime",
          flow: item.flow as "analysis" | "trade",
          clock,
          traceIdSeed: "shared-seed",
          tracePrefix: item.prefix,
          handlers: {
            ingest: async () => ({ payload: { ingest: "ok" } }),
            signal: async () => ({ payload: { signal: "ok" } }),
            reasoning: async () => ({ payload: { reasoning: "ok" } }),
            risk: async () => ({ payload: { risk: "ok" } }),
            execute: async () => ({ payload: { execute: "ok" } }),
            verify: async () => ({ payload: { verify: "ok" } }),
            journal: async () => ({ payload: { journal: "ok" } }),
            monitor: async () => ({ payload: { monitor: "ok" } }),
          },
        })
      )
    );

    expect(runs.every((run) => run.blocked === false)).toBe(true);
    expect(new Set(runs.map((run) => run.decisionHash)).size).toBe(1);
    expect(new Set(runs.map((run) => run.resultHash)).size).toBe(1);
  });
});
