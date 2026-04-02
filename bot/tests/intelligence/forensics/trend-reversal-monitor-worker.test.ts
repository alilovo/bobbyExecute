import { describe, expect, it } from "vitest";
import { DataQualityV1Schema } from "@bot/intelligence/quality/contracts/data-quality.v1.js";
import { CQDSnapshotV1Schema } from "@bot/intelligence/cqd/contracts/cqd.snapshot.v1.js";
import {
  buildSignalPackV1,
  buildTrendReversalMonitorInputV1,
  buildTrendReversalObservationV1,
} from "@bot/intelligence/forensics/index.js";
import { TrendReversalObservationV1Schema } from "@bot/intelligence/forensics/contracts/index.js";

const BASE_MS = 1_720_000_100_000;

function buildQuality(reordered = false, status: "pass" | "fail" = "pass") {
  return DataQualityV1Schema.parse({
    schema_version: "data_quality.v1",
    traceId: "dq-worker",
    timestamp: new Date(BASE_MS).toISOString(),
    completeness: status === "pass" ? 0.93 : 0.44,
    freshness: status === "pass" ? 0.9 : 0.35,
    discrepancy: status === "pass" ? 0.08 : 0.28,
    sourceReliability: 0.87,
    crossSourceConfidence: status === "pass" ? 0.86 : 0.42,
    confidence: status === "pass" ? 0.86 : 0.42,
    source_breakdown: reordered
      ? {
          social: {
            source: "social",
            completeness: 0.6,
            freshness: 0.4,
            reliability: 0.5,
            latency_ms: 1_900,
          },
          market: {
            source: "market",
            completeness: 1,
            freshness: 1,
            reliability: 1,
            latency_ms: 500,
          },
        }
      : {
          market: {
            source: "market",
            completeness: 1,
            freshness: 1,
            reliability: 1,
            latency_ms: 500,
          },
          social: {
            source: "social",
            completeness: 0.6,
            freshness: 0.4,
            reliability: 0.5,
            latency_ms: 1_900,
          },
        },
    discrepancy_flags: reordered
      ? ["dq_divergence:market:social:0.0800"]
      : ["dq_divergence:market:social:0.0800"],
    missingCriticalFields: status === "pass" ? ["holder_count"] : ["holder_count", "price_return_1m"],
    staleSources: ["social"],
    disagreedSources: reordered
      ? { priceUsd: ["social", "market"] }
      : { priceUsd: ["market", "social"] },
    routeViable: true,
    liquidityEligible: status === "pass",
    status,
    reasonCodes: status === "pass" ? ["DQ_STALE_SOURCES"] : ["DQ_STALE_SOURCES", "DQ_HIGH_DISCREPANCY"],
  });
}

function buildCqd(reordered = false, expandedVolume = false) {
  return CQDSnapshotV1Schema.parse({
    schema_version: "cqd.snapshot.v1",
    chain: "solana",
    token: "SOL",
    ts_bucket: Math.floor(BASE_MS / 60_000),
    features: reordered
        ? {
          volume_24h_usd: 760_000,
          liquidity_usd: 1_050_000,
          holder_count: 1_100,
          holder_concentration_pct: 0.27,
          holder_turnover_pct: 0.06,
          participation_pct: 0.61,
          net_flow_usd: -8_000,
          relative_volume_pct: expandedVolume ? 1.34 : 0.94,
          volume_momentum_pct: expandedVolume ? 0.19 : -0.03,
          spread_pct: 0.003,
          atr_pct: 0.06,
          range_pct: 0.2,
          drawdown_pct: 0.12,
          price_return_1m: -0.03,
          liquidity_score: 0.76,
          depth_usd: 210_000,
        }
      : {
          price_return_1m: -0.03,
          drawdown_pct: 0.12,
          range_pct: 0.2,
          atr_pct: 0.06,
          liquidity_usd: 1_050_000,
          liquidity_score: 0.76,
          spread_pct: 0.003,
          depth_usd: 210_000,
          volume_24h_usd: 760_000,
          relative_volume_pct: expandedVolume ? 1.34 : 0.94,
          volume_momentum_pct: expandedVolume ? 0.19 : -0.03,
          holder_count: 1_100,
          holder_concentration_pct: 0.27,
          holder_turnover_pct: 0.06,
          net_flow_usd: -8_000,
          participation_pct: 0.61,
        },
    confidence: 0.8,
    anomaly_flags: reordered
      ? ["cqd_partial", "cqd_divergence"]
      : ["cqd_divergence", "cqd_partial"],
    evidence_pack: reordered ? ["ev-c", "ev-b", "ev-a"] : ["ev-a", "ev-b", "ev-c"],
    source_summaries: reordered
      ? [
          { source: "social", freshness_ms: 1_900, status: "STALE" },
          { source: "market", freshness_ms: 500, status: "OK" },
        ]
      : [
          { source: "market", freshness_ms: 500, status: "OK" },
          { source: "social", freshness_ms: 1_900, status: "STALE" },
        ],
    sources: {
      freshest_source_ts_ms: BASE_MS,
      max_staleness_ms: 1_900,
      price_divergence_pct: 0.08,
      volume_divergence_pct: 0.04,
      liquidity_divergence_pct: 0.02,
    },
    hash: "cqd-worker-hash",
  });
}

function buildSparseCqd() {
  return CQDSnapshotV1Schema.parse({
    schema_version: "cqd.snapshot.v1",
    chain: "solana",
    token: "SOL",
    ts_bucket: Math.floor(BASE_MS / 60_000),
    features: {
      price_return_1m: -0.02,
      drawdown_pct: 0.08,
      range_pct: 0.11,
      liquidity_usd: 420_000,
    },
    confidence: 0.48,
    anomaly_flags: ["cqd_partial"],
    evidence_pack: ["ev-sparse"],
    source_summaries: [
      { source: "market", freshness_ms: 500, status: "OK" },
      { source: "social", freshness_ms: 1_900, status: "STALE" },
    ],
    sources: {
      freshest_source_ts_ms: BASE_MS,
      max_staleness_ms: 1_900,
    },
    hash: "cqd-sparse-worker-hash",
  });
}

function buildMonitorInput(options: {
  traceId: string;
  quality: ReturnType<typeof buildQuality>;
  cqd: ReturnType<typeof buildCqd>;
  signalPackOptions: Omit<
    Parameters<typeof buildSignalPackV1>[0],
    "token" | "traceId" | "dataQuality" | "cqdSnapshot"
  >;
}) {
  const signalPack = buildSignalPackV1({
    token: "SOL",
    traceId: `${options.traceId}:signal-pack`,
    dataQuality: options.quality,
    cqdSnapshot: options.cqd,
    ...options.signalPackOptions,
  });

  return buildTrendReversalMonitorInputV1({
    token: "SOL",
    traceId: options.traceId,
    dataQuality: options.quality,
    cqdSnapshot: options.cqd,
    signalPack,
    evidenceRefs: ["worker-evidence-b", "worker-evidence-a"],
    notes: ["worker_input"],
  });
}

describe("trend reversal monitor worker", () => {
  it("produces deterministic observations for reordered equivalent inputs", () => {
    const inputA = buildMonitorInput({
      traceId: "worker-deterministic",
      quality: buildQuality(false),
      cqd: buildCqd(false),
      signalPackOptions: {
        evidenceRefs: ["signal-b", "signal-a"],
        marketStructureHints: {
          observedHigh: 110,
          observedLow: 92,
          lastPrice: 97,
          priceReturnPct: -0.03,
          drawdownPct: 0.12,
          rangePct: 0.2,
          reclaimGapPct: 0.04,
          higherLowPct: 0.03,
          notes: ["market_b", "market_a"],
        },
        holderFlowHints: {
          holderCount: 1_100,
          holderConcentrationPct: 0.27,
          holderTurnoverPct: 0.06,
          netFlowUsd: -8_000,
          participationPct: 0.61,
          notes: ["holder_b", "holder_a"],
        },
        manipulationFlagsHints: {
          washTradingSuspected: false,
          spoofingSuspected: null,
          concentrationFragility: true,
          anomalyFlags: ["watch-b", "watch-a"],
          notes: ["manipulation_b", "manipulation_a"],
        },
        sourceCoverageHints: {
          social: {
            status: "STALE",
            completeness: 0.6,
            freshness: 0.4,
            freshnessMs: 1_900,
            evidenceRefs: ["signal-b", "signal-a"],
          },
          market: {
            status: "OK",
            completeness: 1,
            freshness: 1,
            freshnessMs: 500,
            evidenceRefs: ["signal-a", "signal-b"],
          },
        },
        notes: ["pack_b", "pack_a"],
      },
    });

    const inputB = buildMonitorInput({
      traceId: "worker-deterministic",
      quality: buildQuality(true),
      cqd: buildCqd(true),
      signalPackOptions: {
        evidenceRefs: ["signal-a", "signal-b"],
        marketStructureHints: {
          lastPrice: 97,
          observedLow: 92,
          observedHigh: 110,
          reclaimGapPct: 0.04,
          drawdownPct: 0.12,
          priceReturnPct: -0.03,
          higherLowPct: 0.03,
          notes: ["market_a", "market_b"],
        },
        holderFlowHints: {
          participationPct: 0.61,
          netFlowUsd: -8_000,
          holderTurnoverPct: 0.06,
          holderCount: 1_100,
          holderConcentrationPct: 0.27,
          notes: ["holder_a", "holder_b"],
        },
        manipulationFlagsHints: {
          concentrationFragility: true,
          washTradingSuspected: false,
          anomalyFlags: ["watch-a", "watch-b"],
          notes: ["manipulation_a", "manipulation_b"],
        },
        sourceCoverageHints: {
          market: {
            status: "OK",
            freshness: 1,
            completeness: 1,
            freshnessMs: 500,
            evidenceRefs: ["signal-b", "signal-a"],
          },
          social: {
            status: "STALE",
            freshness: 0.4,
            completeness: 0.6,
            freshnessMs: 1_900,
            evidenceRefs: ["signal-a", "signal-b"],
          },
        },
        notes: ["pack_a", "pack_b"],
      },
    });

    const observationA = buildTrendReversalObservationV1(inputA);
    const observationB = buildTrendReversalObservationV1(inputB);

    expect(TrendReversalObservationV1Schema.parse(observationA)).toEqual(observationA);
    expect(observationA).toEqual(observationB);
    expect(observationA.evidenceRefs).toEqual([
      "ev-a",
      "ev-b",
      "ev-c",
      "signal-a",
      "signal-b",
      "worker-evidence-a",
      "worker-evidence-b",
    ]);
    expect(Object.keys(observationA.sourceCoverage)).toEqual(["market", "social"]);
  });

  it("derives dead_bounce when no reclaim structure is forming", () => {
    const observation = buildTrendReversalObservationV1(
      buildMonitorInput({
        traceId: "worker-state-dead_bounce",
        quality: buildQuality(),
        cqd: buildCqd(),
        signalPackOptions: {
          evidenceRefs: ["state-a"],
          marketStructureHints: {
            lastPrice: 96,
            observedHigh: 100,
            priceReturnPct: 0.01,
            drawdownPct: 0.04,
          },
          holderFlowHints: {
            holderCount: 1_100,
            holderConcentrationPct: 0.27,
            holderTurnoverPct: 0.06,
            participationPct: 0.61,
          },
          manipulationFlagsHints: {
            concentrationFragility: true,
          },
        },
      })
    );

    expect(observation.state).toBe("dead_bounce");
    expect(observation.confidence).toBeGreaterThan(0);
  });

  it("derives reclaim_attempt when a reclaim is forming without higher-low confirmation", () => {
    const observation = buildTrendReversalObservationV1(
      buildMonitorInput({
        traceId: "worker-state-reclaim_attempt",
        quality: buildQuality(),
        cqd: buildCqd(),
        signalPackOptions: {
          evidenceRefs: ["state-a"],
          marketStructureHints: {
            lastPrice: 97,
            observedHigh: 100,
            priceReturnPct: -0.02,
            drawdownPct: 0.08,
            reclaimGapPct: 0.03,
          },
          holderFlowHints: {
            holderCount: 1_100,
            holderConcentrationPct: 0.27,
            holderTurnoverPct: 0.06,
            participationPct: 0.61,
          },
          manipulationFlagsHints: {
            concentrationFragility: true,
          },
        },
      })
    );

    expect(observation.state).toBe("reclaim_attempt");
  });

  it("derives weak_reclaim when resistance rejection remains visible", () => {
    const observation = buildTrendReversalObservationV1(
      buildMonitorInput({
        traceId: "worker-state-weak_reclaim",
        quality: buildQuality(),
        cqd: buildCqd(),
        signalPackOptions: {
          evidenceRefs: ["state-a"],
          marketStructureHints: {
            lastPrice: 95,
            observedHigh: 100,
            priceReturnPct: -0.03,
            drawdownPct: 0.12,
          },
          holderFlowHints: {
            holderCount: 1_100,
            holderConcentrationPct: 0.27,
            holderTurnoverPct: 0.06,
            participationPct: 0.61,
          },
          manipulationFlagsHints: {
            concentrationFragility: true,
          },
        },
      })
    );

    expect(observation.state).toBe("weak_reclaim");
  });

  it("derives structure_shift_possible when higher-low and reclaim are visible but volume expansion is not", () => {
    const observation = buildTrendReversalObservationV1(
      buildMonitorInput({
        traceId: "worker-state-structure_shift_possible",
        quality: buildQuality(),
        cqd: buildCqd(),
        signalPackOptions: {
          evidenceRefs: ["state-a"],
          marketStructureHints: {
            lastPrice: 98,
            observedHigh: 100,
            priceReturnPct: -0.01,
            drawdownPct: 0.06,
            reclaimGapPct: 0.03,
            higherLowPct: 0.03,
          },
          holderFlowHints: {
            netFlowUsd: -1_000,
            holderCount: 1_100,
            holderConcentrationPct: 0.27,
            holderTurnoverPct: 0.06,
            participationPct: 0.61,
          },
          sourceCoverageHints: {
            market: { status: "OK", completeness: 1, freshness: 1, freshnessMs: 400 },
          },
          manipulationFlagsHints: {
            concentrationFragility: true,
          },
        },
      })
    );

    expect(observation.state).toBe("structure_shift_possible");
  });

  it("derives structure_shift_confirming when higher-low, reclaim, and volume expansion align", () => {
    const observation = buildTrendReversalObservationV1(
      buildMonitorInput({
        traceId: "worker-state-structure_shift_confirming",
        quality: buildQuality(),
        cqd: buildCqd(false, true),
        signalPackOptions: {
          evidenceRefs: ["state-a"],
          marketStructureHints: {
            lastPrice: 99,
            observedHigh: 100,
            priceReturnPct: 0.02,
            drawdownPct: 0.04,
            reclaimGapPct: 0.02,
            higherLowPct: 0.04,
          },
          holderFlowHints: {
            netFlowUsd: 2_000,
            holderCount: 1_100,
            holderConcentrationPct: 0.27,
            holderTurnoverPct: 0.06,
            participationPct: 0.61,
          },
          manipulationFlagsHints: {
            concentrationFragility: true,
          },
        },
      })
    );

    expect(observation.state).toBe("structure_shift_confirming");
    expect(observation.confidence).toBeGreaterThan(0);
  });

  it("fails closed when data quality fails", () => {
    const input = buildMonitorInput({
      traceId: "worker-fail-closed",
      quality: buildQuality(false, "fail"),
      cqd: buildCqd(false),
      signalPackOptions: {
        evidenceRefs: ["fail-a"],
        marketStructureHints: {
          lastPrice: 94,
          observedHigh: 100,
          priceReturnPct: -0.04,
          drawdownPct: 0.18,
          reclaimGapPct: 0.08,
        },
      },
    });

    const observation = buildTrendReversalObservationV1(input);

    expect(observation.state).toBe("invalidated");
    expect(observation.confidence).toBe(0);
    expect(observation.invalidationReasons).toContain("data_quality_fail");
  });

  it("preserves partial signals and explicit missing fields", () => {
    const input = buildMonitorInput({
      traceId: "worker-missing-data",
      quality: buildQuality(),
      cqd: buildSparseCqd(),
      signalPackOptions: {
        evidenceRefs: ["missing-a"],
        marketStructureHints: {
          lastPrice: 97,
          drawdownPct: 0.08,
        },
      },
    });

    const observation = buildTrendReversalObservationV1(input);

    expect(observation.state).toBe("dead_bounce");
    expect(observation.structureSignals.higherLowForming).toBeNull();
    expect(observation.structureSignals.reclaimingLevel).toBeNull();
    expect(observation.participationSignals.buyerStrengthIncreasing).toBeNull();
    expect(observation.participationSignals.volumeExpansion).toBeNull();
    expect(observation.missingFields).toEqual(
      expect.arrayContaining([
        "structureSignals.higherLowForming",
        "structureSignals.reclaimingLevel",
        "structureSignals.rejectionAtResistance",
        "participationSignals.buyerStrengthIncreasing",
        "participationSignals.volumeExpansion",
      ])
    );
  });
});
