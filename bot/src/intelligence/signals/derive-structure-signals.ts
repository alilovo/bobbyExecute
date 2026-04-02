/**
 * Structure-family signal derivation.
 * Observational only; no pattern or decision semantics.
 */
import { clamp01, uniqueSorted } from "../forensics/deterministic.js";
import type { BuildConstructedSignalSetV1Input } from "./build-constructed-signal-set.js";
import {
  ConstructedSignalV1Schema,
  type ConstructedSignalV1,
} from "./contracts/index.js";

function evidenceRefs(input: BuildConstructedSignalSetV1Input): string[] {
  return uniqueSorted([
    ...(input.evidenceRefs ?? []),
    ...input.cqdSnapshot.evidence_pack,
    ...input.signalPack.evidenceRefs,
    ...(input.trendReversalObservation?.evidenceRefs ?? []),
  ]);
}

function supportStatus(values: readonly (number | boolean | null | undefined)[]): "present" | "partial" | "missing" {
  const present = values.filter((value) => value !== null && value !== undefined).length;
  if (present === 0) {
    return "missing";
  }
  if (present < values.length) {
    return "partial";
  }
  return "present";
}

function commonConfidence(input: BuildConstructedSignalSetV1Input): number | null {
  const values = [input.dataQuality.confidence, input.cqdSnapshot.confidence]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? clamp01(Math.min(...values)) : null;
}

export function deriveStructureSignals(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalV1[] {
  const market = input.signalPack.marketStructure;
  const trend = input.trendReversalObservation;
  const refs = evidenceRefs(input);
  const confidence = commonConfidence(input);
  const workerState = trend?.state ?? null;

  return [
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "structure_weakness",
      direction: "bearish",
      strength:
        market.drawdownPct !== null ||
        market.priceReturnPct !== null ||
        trend?.structureSignals.breakdownInvalidation === true
          ? trend?.structureSignals.breakdownInvalidation === true
            ? 0.85
            : 0.5
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(market.drawdownPct === null ? ["signalPack.marketStructure.drawdownPct"] : []),
        ...(market.priceReturnPct === null ? ["signalPack.marketStructure.priceReturnPct"] : []),
        ...(trend?.structureSignals.breakdownInvalidation === null
          ? ["trendReversalObservation.structureSignals.breakdownInvalidation"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(market.drawdownPct !== null ? ["basis:drawdown_pct"] : []),
        ...(market.priceReturnPct !== null ? ["basis:price_return_pct"] : []),
        ...(trend?.structureSignals.breakdownInvalidation === true
          ? ["worker:breakdown_invalidation"]
          : []),
        ...(workerState ? [`worker_state:${workerState}`] : []),
      ]),
      status: supportStatus([
        market.drawdownPct,
        market.priceReturnPct,
        trend?.structureSignals.breakdownInvalidation,
      ]),
    }),
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "reclaim_attempt",
      direction: "bullish",
      strength:
        market.reclaimGapPct !== null || trend?.structureSignals.reclaimingLevel === true
          ? trend?.structureSignals.reclaimingLevel === true
            ? 0.75
            : 0.45
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(market.reclaimGapPct === null ? ["signalPack.marketStructure.reclaimGapPct"] : []),
        ...(trend?.structureSignals.reclaimingLevel === null
          ? ["trendReversalObservation.structureSignals.reclaimingLevel"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(market.reclaimGapPct !== null ? ["basis:reclaim_gap_pct"] : []),
        ...(trend?.structureSignals.reclaimingLevel === true ? ["worker_reclaiming_level:true"] : []),
        ...(workerState ? [`worker_state:${workerState}`] : []),
      ]),
      status: supportStatus([
        market.reclaimGapPct,
        trend?.structureSignals.reclaimingLevel,
      ]),
    }),
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "possible_structure_shift",
      direction: "bullish",
      strength:
        trend?.structureSignals.higherLowForming === true &&
        (trend.structureSignals.reclaimingLevel === true || market.higherLowPct !== null)
          ? trend.structureSignals.reclaimingLevel === true
            ? 0.85
            : 0.65
          : trend?.structureSignals.higherLowForming === true
            ? 0.55
            : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(market.higherLowPct === null ? ["signalPack.marketStructure.higherLowPct"] : []),
        ...(trend?.structureSignals.higherLowForming === null
          ? ["trendReversalObservation.structureSignals.higherLowForming"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(market.higherLowPct !== null ? ["basis:higher_low_pct"] : []),
        ...(trend?.structureSignals.higherLowForming === true ? ["worker_higher_low_forming:true"] : []),
        ...(trend?.state === "structure_shift_possible" ? ["worker_state:structure_shift_possible"] : []),
        ...(trend?.state === "structure_shift_confirming" ? ["worker_state:structure_shift_confirming"] : []),
      ]),
      status: supportStatus([
        market.higherLowPct,
        trend?.structureSignals.higherLowForming,
        trend?.structureSignals.reclaimingLevel,
      ]),
    }),
  ];
}
