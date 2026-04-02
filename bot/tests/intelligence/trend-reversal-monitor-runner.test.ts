import { describe, expect, it, vi } from "vitest";
import { InMemoryJournalWriter } from "../../src/journal-writer/writer.js";
import { WatchCandidateRegistry } from "../../src/discovery/watch-candidate-registry.js";
import { TrendReversalMonitorRunner } from "../../src/intelligence/forensics/trend-reversal-monitor-runner.js";

describe("TrendReversalMonitorRunner", () => {
  it("emits observations only for active candidates with sufficient quality", async () => {
    const registry = new WatchCandidateRegistry({ now: () => 1_000 });
    registry.upsertCandidate({
      token: "BONK",
      source: "llm_downtrend_worker",
      observationCompleteness: 0.82,
      monitorRecommendation: "monitor",
      confidenceBand: "medium",
      evidenceRefs: ["disc-1"],
    });
    registry.upsertCandidate({
      token: "WIF",
      source: "llm_downtrend_worker",
      observationCompleteness: 0.74,
      monitorRecommendation: "monitor",
      confidenceBand: "medium",
      evidenceRefs: ["disc-2"],
    });

    const journalWriter = new InMemoryJournalWriter();
    const runner = new TrendReversalMonitorRunner({
      registry,
      journalWriter,
      now: () => 2_000,
      dataQualityByToken: (token) =>
        token === "BONK"
          ? {
              version: "1.0",
              token,
              chain: "solana",
              status: "pass",
              completeness: 0.9,
              freshnessScore: 0.88,
              divergenceScore: 0.03,
              crossSourceConfidence: 0.91,
              missingCriticalFields: [],
              staleSources: [],
              disagreedSources: [],
              routeViable: true,
              liquidityEligible: true,
              reasons: ["monitor"],
            }
          : {
              version: "1.0",
              token,
              chain: "solana",
              status: "hold",
              completeness: 0.65,
              freshnessScore: 0.7,
              divergenceScore: 0.2,
              crossSourceConfidence: 0.5,
              missingCriticalFields: [],
              staleSources: [],
              disagreedSources: [],
              routeViable: true,
              liquidityEligible: true,
              reasons: ["thin_data"],
            },
    });

    const result = await runner.runOnce();

    expect(result.checkedCandidates).toBe(1);
    expect(result.emittedObservations).toHaveLength(1);
    expect(result.emittedObservations[0]).toMatchObject({
      schema_version: "trend_reversal_observation.v1",
      token: "BONK",
      state: "reclaim_attempt",
      evidenceRefs: ["disc-1"],
    });

    const entries = journalWriter.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.stage).toBe("sidecar.monitor.observation");
  });

  it("supports custom deterministic monitor logic", async () => {
    const registry = new WatchCandidateRegistry({ now: () => 10 });
    registry.upsertCandidate({
      token: "POPCAT",
      source: "llm_downtrend_worker",
      observationCompleteness: 0.95,
      monitorRecommendation: "monitor",
      confidenceBand: "high",
      evidenceRefs: ["disc-9"],
    });

    const monitorCandidate = vi.fn().mockReturnValue({
      schema_version: "trend_reversal_observation.v1",
      token: "POPCAT",
      chain: "solana",
      observedAt: new Date(99).toISOString(),
      inputRef: "monitor-ref",
      state: "structure_shift_possible",
      confidence: 0.99,
      structureSignals: {
        higherLowForming: true,
        reclaimingLevel: true,
        rejectionAtResistance: false,
        breakdownInvalidation: false,
      },
      participationSignals: {
        buyerStrengthIncreasing: true,
        volumeExpansion: true,
        holderGrowthVisible: true,
      },
      riskSignals: {
        liquidityDrop: false,
        distributionRisk: false,
        exhaustionWickPattern: false,
      },
      invalidationReasons: [],
      evidenceRefs: ["disc-9"],
      missingFields: [],
      sourceCoverage: {},
    });

    const runner = new TrendReversalMonitorRunner({
      registry,
      monitorCandidate,
      now: () => 99,
    });

    const result = await runner.runOnce();

    expect(monitorCandidate).toHaveBeenCalledTimes(1);
    expect(result.emittedObservations[0]?.state).toBe("structure_shift_possible");
  });
});
