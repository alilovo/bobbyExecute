/**
 * Shadow-only trend reversal monitor worker.
 * Consumes TrendReversalMonitorInputV1 and emits a non-authoritative observation artifact.
 */
import { hashResult } from "../../core/determinism/hash.js";
import { clamp01, sortRecord, uniqueSorted } from "./deterministic.js";
import type { TrendReversalMonitorInputV1 } from "./contracts/trend-reversal-monitor-input.v1.js";
import {
  TrendReversalObservationParticipationSignalsSchema,
  TrendReversalObservationRiskSignalsSchema,
  TrendReversalObservationSourceCoverageEntrySchema,
  TrendReversalObservationStructureSignalsSchema,
  TrendReversalObservationV1Schema,
  type TrendReversalObservationParticipationSignals,
  type TrendReversalObservationRiskSignals,
  type TrendReversalObservationSourceCoverageEntry,
  type TrendReversalObservationState,
  type TrendReversalObservationStructureSignals,
  type TrendReversalObservationV1,
} from "./contracts/trend-reversal-observation.v1.js";

function computeSourceCoverage(
  input: TrendReversalMonitorInputV1
): Record<string, TrendReversalObservationSourceCoverageEntry> {
  const keys = uniqueSorted([
    ...Object.keys(input.signalPack.sourceCoverage),
    ...Object.keys(input.dataQuality.source_breakdown),
    ...(input.cqdSnapshot.source_summaries ?? []).map((summary) => summary.source),
  ]);

  return sortRecord(
    Object.fromEntries(
      keys.map((source) => {
        const packEntry = input.signalPack.sourceCoverage[source];
        const dataQualitySource = input.dataQuality.source_breakdown[source];
        const cqdSummary = (input.cqdSnapshot.source_summaries ?? []).find(
          (summary) => summary.source === source
        );
        const status =
          packEntry?.status ??
          cqdSummary?.status ??
          (dataQualitySource
            ? dataQualitySource.freshness === 1 && dataQualitySource.completeness === 1
              ? "OK"
              : dataQualitySource.completeness > 0 || dataQualitySource.freshness > 0
                ? "PARTIAL"
                : "MISSING"
            : "MISSING");

        return [
          source,
          TrendReversalObservationSourceCoverageEntrySchema.parse({
            status,
            isStale:
              status === "STALE" || input.dataQuality.staleSources.includes(source),
          }),
        ];
      })
    )
  );
}

export function deriveStructureSignals(
  input: TrendReversalMonitorInputV1
): TrendReversalObservationStructureSignals {
  const market = input.signalPack.marketStructure;
  const result = {
    higherLowForming:
      market.higherLowPct === null ? null : market.higherLowPct > 0,
    reclaimingLevel:
      market.reclaimGapPct === null ? null : market.reclaimGapPct <= 0.05,
    rejectionAtResistance:
      market.lastPrice === null ||
      market.observedHigh === null ||
      market.priceReturnPct === null
        ? null
        : market.lastPrice < market.observedHigh && market.priceReturnPct <= 0,
    breakdownInvalidation:
      market.lastPrice === null || market.observedLow === null
        ? null
        : market.lastPrice < market.observedLow,
  };

  return TrendReversalObservationStructureSignalsSchema.parse(result);
}

export function deriveParticipationSignals(
  input: TrendReversalMonitorInputV1
): TrendReversalObservationParticipationSignals {
  const volume = input.signalPack.volume;
  const holderFlow = input.signalPack.holderFlow;
  const result = {
    buyerStrengthIncreasing:
      holderFlow.netFlowUsd !== null
        ? holderFlow.netFlowUsd > 0
        : volume.volumeMomentumPct !== null
          ? volume.volumeMomentumPct > 0
          : null,
    volumeExpansion:
      volume.relativeVolumePct !== null
        ? volume.relativeVolumePct > 1
        : volume.volumeMomentumPct !== null
          ? volume.volumeMomentumPct > 0
          : null,
    holderGrowthVisible:
      holderFlow.holderCount !== null
        ? holderFlow.holderCount > 0
        : holderFlow.participationPct !== null
          ? holderFlow.participationPct > 0
          : null,
  };

  return TrendReversalObservationParticipationSignalsSchema.parse(result);
}

export function deriveRiskSignals(
  input: TrendReversalMonitorInputV1
): TrendReversalObservationRiskSignals {
  const liquidity = input.signalPack.liquidity;
  const holderFlow = input.signalPack.holderFlow;
  const market = input.signalPack.marketStructure;
  const result = {
    liquidityDrop:
      liquidity.liquidityScore !== null
        ? liquidity.liquidityScore < 0.5
        : liquidity.liquidityUsd !== null
          ? liquidity.liquidityUsd < 750_000
          : null,
    distributionRisk:
      holderFlow.holderConcentrationPct === null
        ? null
        : holderFlow.holderConcentrationPct >= 0.3,
    exhaustionWickPattern:
      market.drawdownPct === null || market.rangePct === null
        ? null
        : market.drawdownPct > 0.15 && market.rangePct > 0.1,
  };

  return TrendReversalObservationRiskSignalsSchema.parse(result);
}

export function deriveState(
  structureSignals: TrendReversalObservationStructureSignals,
  participationSignals: TrendReversalObservationParticipationSignals,
  failClosed: boolean
): TrendReversalObservationState {
  if (failClosed || structureSignals.breakdownInvalidation === true) {
    return "invalidated";
  }

  if (
    structureSignals.higherLowForming === true &&
    structureSignals.reclaimingLevel === true &&
    participationSignals.volumeExpansion === true
  ) {
    return "structure_shift_confirming";
  }

  if (
    structureSignals.higherLowForming === true &&
    (structureSignals.reclaimingLevel === true ||
      participationSignals.buyerStrengthIncreasing === true ||
      participationSignals.volumeExpansion === true)
  ) {
    return "structure_shift_possible";
  }

  if (structureSignals.reclaimingLevel === true) {
    return "reclaim_attempt";
  }

  if (
    structureSignals.rejectionAtResistance === true ||
    participationSignals.buyerStrengthIncreasing === true ||
    participationSignals.volumeExpansion === true
  ) {
    return "weak_reclaim";
  }

  return "dead_bounce";
}

function deriveConfidence(input: TrendReversalMonitorInputV1): number {
  const coverageCompleteness = Object.values(input.signalPack.sourceCoverage)
    .map((entry) => entry.completeness)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const completenessBasis =
    coverageCompleteness.length > 0
      ? coverageCompleteness.reduce((total, value) => total + value, 0) / coverageCompleteness.length
      : null;

  const values = [input.dataQuality.confidence, input.cqdSnapshot.confidence, completenessBasis]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return 0;
  }

  return clamp01(Math.min(...values));
}

function collectMissingFields(
  input: TrendReversalMonitorInputV1,
  structureSignals: TrendReversalObservationStructureSignals,
  participationSignals: TrendReversalObservationParticipationSignals,
  riskSignals: TrendReversalObservationRiskSignals,
  sourceCoverage: Record<string, TrendReversalObservationSourceCoverageEntry>
): string[] {
  const missing = new Set<string>(input.signalPack.missingFields);

  for (const [field, value] of Object.entries(structureSignals)) {
    if (value === null) {
      missing.add(`structureSignals.${field}`);
    }
  }

  for (const [field, value] of Object.entries(participationSignals)) {
    if (value === null) {
      missing.add(`participationSignals.${field}`);
    }
  }

  for (const [field, value] of Object.entries(riskSignals)) {
    if (value === null) {
      missing.add(`riskSignals.${field}`);
    }
  }

  for (const [source, entry] of Object.entries(sourceCoverage)) {
    if (entry.status === "MISSING") {
      missing.add(`sourceCoverage.${source}.status`);
    }
  }

  return uniqueSorted([...missing]);
}

function collectInvalidationReasons(
  input: TrendReversalMonitorInputV1,
  structureSignals: TrendReversalObservationStructureSignals
): string[] {
  const reasons = new Set<string>();

  if (input.dataQuality.status === "fail") {
    reasons.add("data_quality_fail");
  }

  if (
    input.signalPack.marketStructure.lastPrice === null &&
    input.signalPack.marketStructure.drawdownPct === null &&
    input.signalPack.marketStructure.reclaimGapPct === null
  ) {
    reasons.add("missing_structural_basis");
  }

  if (structureSignals.breakdownInvalidation === true) {
    reasons.add("breakdown_invalidation");
  }

  return uniqueSorted([...reasons]);
}

export function buildTrendReversalObservationV1(
  input: TrendReversalMonitorInputV1
): TrendReversalObservationV1 {
  const structureSignals = deriveStructureSignals(input);
  const participationSignals = deriveParticipationSignals(input);
  const riskSignals = deriveRiskSignals(input);
  const sourceCoverage = computeSourceCoverage(input);
  const invalidationReasons = collectInvalidationReasons(input, structureSignals);
  const state = deriveState(
    structureSignals,
    participationSignals,
    invalidationReasons.length > 0
  );
  const evidenceRefs = uniqueSorted([
    ...(input.evidenceRefs ?? []),
    ...input.signalPack.evidenceRefs,
    ...input.cqdSnapshot.evidence_pack,
  ]);
  const missingFields = collectMissingFields(
    input,
    structureSignals,
    participationSignals,
    riskSignals,
    sourceCoverage
  );
  const observedAt = input.timestamp ?? input.dataQuality.timestamp;
  const confidence = invalidationReasons.length > 0 ? 0 : deriveConfidence(input);
  const payloadWithoutInputRef = {
    schema_version: "trend_reversal_observation.v1" as const,
    token: input.token,
    chain: input.chain ?? "solana",
    observedAt,
    state,
    confidence,
    structureSignals,
    participationSignals,
    riskSignals,
    invalidationReasons,
    evidenceRefs,
    missingFields,
    sourceCoverage,
  };

  return TrendReversalObservationV1Schema.parse({
    ...payloadWithoutInputRef,
    inputRef: hashResult(payloadWithoutInputRef),
  });
}
