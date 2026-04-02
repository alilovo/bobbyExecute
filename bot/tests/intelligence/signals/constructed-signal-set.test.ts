import { describe, expect, it } from "vitest";
import { DataQualityV1Schema } from "@bot/intelligence/quality/contracts/data-quality.v1.js";
import { CQDSnapshotV1Schema } from "@bot/intelligence/cqd/contracts/cqd.snapshot.v1.js";
import {
  buildSignalPackV1,
  buildTrendReversalMonitorInputV1,
} from "@bot/intelligence/forensics/build-signal-pack.js";
import { buildTrendReversalObservationV1 } from "@bot/intelligence/forensics/trend-reversal-monitor-worker.js";
import { buildConstructedSignalSetV1 } from "@bot/intelligence/signals/build-constructed-signal-set.js";
import { ConstructedSignalSetV1Schema } from "@bot/intelligence/signals/contracts/constructed-signal-set.v1.js";

const BASE_MS = 1_720_001_200_000;

function buildQuality(reordered = false, status: "pass" | "fail" = "pass") {
  return DataQualityV1Schema.parse({
    schema_version: "data_quality.v1",
    traceId: "dq-constructed",
    timestamp: new Date(BASE_MS).toISOString(),
    completeness: status === "pass" ? 0.95 : 0.46,
    freshness: status === "pass" ? 0.92 : 0.41,
    discrepancy: status === "pass" ? 0.05 : 0.31,
    sourceReliability: 0.9,
    crossSourceConfidence: status === "pass" ? 0.89 : 0.44,
    confidence: status === "pass" ? 0.89 : 0.44,
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
    reasonCodes: status === "pass" ? ["DQ_STALE_SOURCES"] : ["DQ_STALE_SOURCES", "DQ_LOW_CROSS_SOURCE_CONFIDENCE"],
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
          relative_volume_pct: expandedVolume ? 1.48 : 0.94,
          volume_momentum_pct: expandedVolume ? 0.22 : -0.03,
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
          relative_volume_pct: expandedVolume ? 1.48 : 0.94,
          volume_momentum_pct: expandedVolume ? 0.22 : -0.03,
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
    hash: "cqd-constructed-hash",
  });
}

function buildSignalPack(options: { reordered?: boolean }) {
  return buildSignalPackV1({
    token: "SOL",
    traceId: "signal-pack-constructed",
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

function buildMonitorInput(options: {
  reordered?: boolean;
  includeObservation?: boolean;
  qualityStatus?: "pass" | "fail";
}) {
  const quality = buildQuality(options.reordered ?? false, options.qualityStatus ?? "pass");
  const cqd = buildCqd(options.reordered ?? false, true);
  const signalPack = buildSignalPack({ reordered: options.reordered ?? false });
  const monitorInput = buildTrendReversalMonitorInputV1({
    token: "SOL",
    traceId: "monitor-input-constructed",
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

  return {
    quality,
    cqd,
    signalPack,
    monitorInput,
    observation,
  };
}

describe("constructed signal bridge", () => {
  it("parses cleanly and is deterministic across reordered equivalent inputs", () => {
    const first = buildMonitorInput({ reordered: false, includeObservation: true });
    const second = buildMonitorInput({ reordered: true, includeObservation: true });

    const setA = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set",
      dataQuality: first.quality,
      cqdSnapshot: first.cqd,
      signalPack: first.signalPack,
      trendReversalObservation: first.observation,
      contextAvailability: {
        supplementalHintsAvailable: true,
        missingSupplementalHints: [],
      },
      evidenceRefs: ["bridge-b", "bridge-a"],
    });
    const setB = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set",
      dataQuality: second.quality,
      cqdSnapshot: second.cqd,
      signalPack: second.signalPack,
      trendReversalObservation: second.observation,
      contextAvailability: {
        supplementalHintsAvailable: true,
        missingSupplementalHints: [],
      },
      evidenceRefs: ["bridge-a", "bridge-b"],
    });

    expect(ConstructedSignalSetV1Schema.parse(setA)).toEqual(setA);
    expect(setA).toEqual(setB);
    expect(setA.payloadHash).toBe(setB.payloadHash);
    expect(setA.buildStatus).toBe("built");
    expect(setA.inputRefs).toEqual([
      "cqd:cqd-constructed-hash",
      "data_quality:dq-constructed",
      `signal_pack:${first.signalPack.payloadHash}`,
      "trend_reversal_observation:" + first.observation!.inputRef,
    ]);
    expect(setA.signals.map((signal) => signal.signalType)).toEqual([
      "structure_weakness",
      "reclaim_attempt",
      "possible_structure_shift",
      "participation_improvement",
      "liquidity_fragility",
      "manipulation_caution",
      "downside_continuation_risk",
    ]);
  });

  it("keeps missing and degraded states explicit", () => {
    const context = buildMonitorInput({
      reordered: false,
      includeObservation: false,
    });

    const set = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set-missing",
      dataQuality: context.quality,
      cqdSnapshot: context.cqd,
      signalPack: context.signalPack,
      contextAvailability: {
        supplementalHintsAvailable: false,
        missingSupplementalHints: ["holder_wallet_context"],
      },
      evidenceRefs: ["bridge-missing"],
    });

    expect(set.buildStatus).toBe("degraded");
    expect(set.missingInputs).toEqual(
      expect.arrayContaining([
        "contextAvailability.supplementalHints",
        "trendReversalObservation",
      ])
    );
    expect(set.signals.length).toBeGreaterThan(0);
    expect(set.signals.some((signal) => signal.status === "partial" || signal.status === "missing")).toBe(true);
  });

  it("fails closed on unusable upstream quality", () => {
    const input = buildMonitorInput({
      reordered: false,
      includeObservation: true,
      qualityStatus: "fail",
    });

    const set = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set-invalidated",
      dataQuality: input.quality,
      cqdSnapshot: input.cqd,
      signalPack: input.signalPack,
      trendReversalObservation: input.observation,
      contextAvailability: {
        supplementalHintsAvailable: true,
        missingSupplementalHints: [],
      },
    });

    expect(set.buildStatus).toBe("invalidated");
    expect(set.signals).toHaveLength(0);
    expect(set.missingInputs).toContain("dataQuality.status");
  });

  it("uses trend reversal observation as enrichment without turning it into a decision surrogate", () => {
    const withObservation = buildMonitorInput({
      reordered: false,
      includeObservation: true,
    });
    const withoutObservation = buildMonitorInput({
      reordered: false,
      includeObservation: false,
    });

    const enriched = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set-enriched",
      dataQuality: withObservation.quality,
      cqdSnapshot: withObservation.cqd,
      signalPack: withObservation.signalPack,
      trendReversalObservation: withObservation.observation,
      contextAvailability: {
        supplementalHintsAvailable: true,
        missingSupplementalHints: [],
      },
    });

    const baseline = buildConstructedSignalSetV1({
      token: "SOL",
      traceId: "constructed-set-enriched",
      dataQuality: withoutObservation.quality,
      cqdSnapshot: withoutObservation.cqd,
      signalPack: withoutObservation.signalPack,
      contextAvailability: {
        supplementalHintsAvailable: false,
        missingSupplementalHints: ["holder_wallet_context"],
      },
    });

    expect(enriched.signals.map((signal) => signal.signalType)).toEqual(
      baseline.signals.map((signal) => signal.signalType)
    );
    expect(enriched.buildStatus).toBe("built");
    expect(baseline.buildStatus).toBe("degraded");
    expect(
      enriched.signals.find((signal) => signal.signalType === "possible_structure_shift")?.notes
    ).toEqual(expect.arrayContaining(["worker_state:structure_shift_possible"]));
    expect(Object.keys(enriched.signals[0] ?? {})).not.toContain("decision");
    expect(Object.keys(enriched.signals[0] ?? {})).not.toContain("pattern");
    expect(Object.keys(enriched.signals[0] ?? {})).not.toContain("score");
  });
});
