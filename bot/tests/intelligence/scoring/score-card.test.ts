import { describe, expect, it } from "vitest";
import { DataQualityV1Schema } from "@bot/intelligence/quality/contracts/data-quality.v1.js";
import { CQDSnapshotV1Schema } from "@bot/intelligence/cqd/contracts/cqd.snapshot.v1.js";
import { buildSignalPackV1, buildTrendReversalMonitorInputV1 } from "@bot/intelligence/forensics/build-signal-pack.js";
import { buildTrendReversalObservationV1 } from "@bot/intelligence/forensics/trend-reversal-monitor-worker.js";
import { buildConstructedSignalSetV1 } from "@bot/intelligence/signals/build-constructed-signal-set.js";
import { buildScoreCardV1 } from "@bot/intelligence/scoring/build-score-card.js";
import { ScoreCardV1Schema, ScoreComponentV1Schema } from "@bot/intelligence/scoring/contracts/index.js";

const BASE_MS = 1_720_001_200_000;

function buildQuality(reordered = false, status: "pass" | "fail" = "pass") {
  return DataQualityV1Schema.parse({
    schema_version: "data_quality.v1",
    traceId: "dq-scoring",
    timestamp: new Date(BASE_MS).toISOString(),
    completeness: status === "pass" ? 0.95 : 0.45,
    freshness: status === "pass" ? 0.92 : 0.4,
    discrepancy: status === "pass" ? 0.05 : 0.32,
    sourceReliability: 0.9,
    crossSourceConfidence: status === "pass" ? 0.89 : 0.43,
    confidence: status === "pass" ? 0.89 : 0.43,
    source_breakdown: reordered
      ? {
          social: {
            source: "social",
            completeness: 0.55,
            freshness: 0.35,
            reliability: 0.5,
            latency_ms: 1_800,
          },
          market: {
            source: "market",
            completeness: 1,
            freshness: 1,
            reliability: 1,
            latency_ms: 450,
          },
        }
      : {
          market: {
            source: "market",
            completeness: 1,
            freshness: 1,
            reliability: 1,
            latency_ms: 450,
          },
          social: {
            source: "social",
            completeness: 0.55,
            freshness: 0.35,
            reliability: 0.5,
            latency_ms: 1_800,
          },
        },
    discrepancy_flags: ["dq_divergence:market:social:0.0500"],
    missingCriticalFields: status === "pass" ? [] : ["holder_count"],
    staleSources: ["social"],
    disagreedSources: reordered
      ? { priceUsd: ["social", "market"] }
      : { priceUsd: ["market", "social"] },
    routeViable: true,
    liquidityEligible: true,
    status,
    reasonCodes:
      status === "pass"
        ? ["DQ_STALE_SOURCES"]
        : ["DQ_STALE_SOURCES", "DQ_LOW_CROSS_SOURCE_CONFIDENCE"],
  });
}

function buildCqd(reordered = false) {
  return CQDSnapshotV1Schema.parse({
    schema_version: "cqd.snapshot.v1",
    chain: "solana",
    token: "SOL",
    ts_bucket: Math.floor(BASE_MS / 60_000),
    features: reordered
      ? {
          observed_high: 110,
          observed_low: 93,
          last_price: 99,
          price_return_1m: -0.03,
          drawdown_pct: 0.12,
          range_pct: 0.21,
          reclaim_gap_pct: 0.03,
          lower_high_pct: -0.02,
          higher_low_pct: 0.04,
          pivot_count: 6,
          realized_volatility_pct: 0.43,
          atr_pct: 0.07,
          liquidity_usd: 1_250_000,
          liquidity_score: 0.82,
          spread_pct: 0.003,
          depth_usd: 230_000,
          slippage_pct: 0.02,
          volume_24h_usd: 880_000,
          relative_volume_pct: 1.48,
          volume_momentum_pct: 0.22,
          transfer_count: 87,
          holder_count: 1_500,
          holder_concentration_pct: 0.26,
          holder_turnover_pct: 0.08,
          net_flow_usd: -10_000,
          participation_pct: 0.65,
        }
      : {
          observed_high: 110,
          observed_low: 93,
          last_price: 99,
          price_return_1m: -0.03,
          drawdown_pct: 0.12,
          range_pct: 0.21,
          reclaim_gap_pct: 0.03,
          lower_high_pct: -0.02,
          higher_low_pct: 0.04,
          pivot_count: 6,
          realized_volatility_pct: 0.43,
          atr_pct: 0.07,
          liquidity_usd: 1_250_000,
          liquidity_score: 0.82,
          spread_pct: 0.003,
          depth_usd: 230_000,
          slippage_pct: 0.02,
          volume_24h_usd: 880_000,
          relative_volume_pct: 1.48,
          volume_momentum_pct: 0.22,
          transfer_count: 87,
          holder_count: 1_500,
          holder_concentration_pct: 0.26,
          holder_turnover_pct: 0.08,
          net_flow_usd: -10_000,
          participation_pct: 0.65,
        },
    confidence: 0.8,
    anomaly_flags: reordered ? ["cqd_partial", "cqd_divergence"] : ["cqd_divergence", "cqd_partial"],
    evidence_pack: reordered ? ["ev-c", "ev-b", "ev-a"] : ["ev-a", "ev-b", "ev-c"],
    source_summaries: reordered
      ? [
          { source: "social", freshness_ms: 1_800, status: "STALE" },
          { source: "market", freshness_ms: 450, status: "OK" },
        ]
      : [
          { source: "market", freshness_ms: 450, status: "OK" },
          { source: "social", freshness_ms: 1_800, status: "STALE" },
        ],
    sources: {
      freshest_source_ts_ms: BASE_MS,
      max_staleness_ms: 1_800,
      price_divergence_pct: 0.05,
      volume_divergence_pct: 0.03,
      liquidity_divergence_pct: 0.01,
    },
    hash: "cqd-scoring-hash",
  });
}

function buildSignalPack(options: { reordered?: boolean }) {
  return buildSignalPackV1({
    token: "SOL",
    traceId: "signal-pack-scoring",
    dataQuality: buildQuality(options.reordered ?? false),
    cqdSnapshot: buildCqd(options.reordered ?? false),
    evidenceRefs: ["ev-b", "ev-a"],
    marketStructureHints: {
      observedHigh: 110,
      observedLow: 93,
      lastPrice: 99,
      priceReturnPct: -0.03,
      drawdownPct: 0.12,
      rangePct: 0.21,
      reclaimGapPct: 0.03,
      higherLowPct: 0.04,
      lowerHighPct: -0.02,
      higherHighPct: 0.08,
      lowerLowPct: -0.06,
      pivotCount: 6,
      notes: ["market_b", "market_a"],
    },
    holderFlowHints: {
      holderCount: 1_500,
      holderConcentrationPct: 0.26,
      holderTurnoverPct: 0.08,
      netFlowUsd: -10_000,
      participationPct: 0.65,
      notes: ["holder_b", "holder_a"],
    },
    manipulationFlagsHints: {
      washTradingSuspected: false,
      spoofingSuspected: false,
      concentrationFragility: true,
      staleSourceRisk: true,
      crossSourceDivergence: true,
      anomalyFlags: ["manual_watch"],
      notes: ["manipulation_b", "manipulation_a"],
    },
    sourceCoverageHints: {
      market: {
        status: "OK",
        completeness: 1,
        freshness: 1,
        freshnessMs: 450,
        evidenceRefs: ["ev-a", "ev-b"],
        notes: ["market_a", "market_b"],
      },
      social: {
        status: "STALE",
        completeness: 0.55,
        freshness: 0.35,
        freshnessMs: 1_800,
        evidenceRefs: ["ev-c"],
        notes: ["social_a", "social_b"],
      },
    },
    notes: ["signal_pack_a", "signal_pack_b"],
  });
}

function buildConstructedSet(options: {
  reordered?: boolean;
  includeObservation?: boolean;
  qualityStatus?: "pass" | "fail";
}) {
  const quality = buildQuality(options.reordered ?? false, options.qualityStatus ?? "pass");
  const cqd = buildCqd(options.reordered ?? false);
  const signalPack = buildSignalPack({ reordered: options.reordered ?? false });
  const monitorInput = buildTrendReversalMonitorInputV1({
    token: "SOL",
    traceId: "monitor-input-scoring",
    dataQuality: quality,
    cqdSnapshot: cqd,
    signalPack,
    evidenceRefs: ["bridge-a", "bridge-b"],
    contextAvailability: {
      supplementalHintsAvailable: options.includeObservation ?? false,
      missingSupplementalHints: options.includeObservation ? [] : ["holder_wallet_context"],
    },
  });

  const observation = options.includeObservation
    ? buildTrendReversalObservationV1(monitorInput)
    : null;

  const constructedSignalSet = buildConstructedSignalSetV1({
    token: "SOL",
    traceId: "constructed-set-scoring",
    dataQuality: quality,
    cqdSnapshot: cqd,
    signalPack,
    trendReversalObservation: observation,
    contextAvailability: {
      supplementalHintsAvailable: options.includeObservation ?? false,
      missingSupplementalHints: options.includeObservation ? [] : ["holder_wallet_context"],
    },
    evidenceRefs: ["bridge-b", "bridge-a"],
  });

  return {
    quality,
    cqd,
    signalPack,
    monitorInput,
    observation,
    constructedSignalSet,
  };
}

describe("score card bridge", () => {
  it("parses cleanly and exposes a stable contract surface", () => {
    const { constructedSignalSet } = buildConstructedSet({
      reordered: false,
      includeObservation: true,
    });

    const scoreCard = buildScoreCardV1({
      constructedSignalSet,
    });

    expect(ScoreCardV1Schema.parse(scoreCard)).toEqual(scoreCard);
    expect(ScoreComponentV1Schema.parse(scoreCard.componentScores[0])).toEqual(
      scoreCard.componentScores[0]
    );
    expect(scoreCard.componentScores).toHaveLength(6);
    expect(scoreCard.buildStatus).toBe("built");
    expect(scoreCard.componentScores.map((component) => component.componentId)).toEqual([
      "structure",
      "participation",
      "fragility",
      "manipulation_caution",
      "reversal_quality",
      "downside_continuation_risk",
    ]);
    expect(Object.keys(scoreCard)).not.toContain("decision");
    expect(Object.keys(scoreCard)).not.toContain("policy");
    expect(Object.keys(scoreCard)).not.toContain("execute");
    expect(Object.keys(scoreCard)).not.toContain("tradeable");
    expect(Object.keys(scoreCard)).not.toContain("approved");
    expect(Object.keys(scoreCard)).not.toContain("eligible");
  });

  it("is deterministic for reordered equivalent constructed inputs", () => {
    const first = buildConstructedSet({
      reordered: false,
      includeObservation: true,
    });
    const second = buildConstructedSet({
      reordered: true,
      includeObservation: true,
    });

    const scoreA = buildScoreCardV1({
      constructedSignalSet: first.constructedSignalSet,
    });
    const scoreB = buildScoreCardV1({
      constructedSignalSet: second.constructedSignalSet,
    });

    expect(scoreA).toEqual(scoreB);
    expect(scoreA.payloadHash).toBe(scoreB.payloadHash);
    expect(scoreA.aggregateScores).toEqual(scoreB.aggregateScores);
    expect(scoreA.componentScores.map((component) => component.componentId)).toEqual(
      scoreB.componentScores.map((component) => component.componentId)
    );
  });

  it("keeps degraded and invalidated states honest", () => {
    const degraded = buildConstructedSet({
      reordered: false,
      includeObservation: false,
    });
    const invalidated = buildConstructedSet({
      reordered: false,
      includeObservation: true,
      qualityStatus: "fail",
    });

    const degradedCard = buildScoreCardV1({
      constructedSignalSet: degraded.constructedSignalSet,
    });
    const invalidatedCard = buildScoreCardV1({
      constructedSignalSet: invalidated.constructedSignalSet,
    });

    expect(degradedCard.buildStatus).toBe("degraded");
    expect(degradedCard.missingInputs).toEqual(
      expect.arrayContaining([
        "contextAvailability.supplementalHints",
        "trendReversalObservation",
      ])
    );
    expect(degradedCard.confidence).not.toBeNull();
    expect(degradedCard.componentScores.some((component) => component.status !== "present")).toBe(
      true
    );

    expect(invalidatedCard.buildStatus).toBe("invalidated");
    expect(invalidatedCard.confidence).toBeNull();
    expect(invalidatedCard.aggregateScores).toEqual({
      constructive: null,
      riskPressure: null,
      composite: null,
    });
    expect(invalidatedCard.componentScores.every((component) => component.status === "missing")).toBe(
      true
    );
    expect(invalidatedCard.componentScores.every((component) => component.score === null)).toBe(
      true
    );
    expect(invalidatedCard.missingInputs).toContain("scoreCard.buildStatus.invalidated");
  });
});
