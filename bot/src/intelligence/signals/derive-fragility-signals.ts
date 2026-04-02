/**
 * Fragility-family signal derivation.
 * Observational only and intentionally non-authoritative.
 */
import { clamp01, uniqueSorted } from "../forensics/deterministic.js";
import type { BuildConstructedSignalSetV1Input } from "./build-constructed-signal-set.js";
import {
  ConstructedSignalV1Schema,
  type ConstructedSignalV1,
} from "./contracts/index.js";

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

function evidenceRefs(input: BuildConstructedSignalSetV1Input): string[] {
  return uniqueSorted([
    ...(input.evidenceRefs ?? []),
    ...input.cqdSnapshot.evidence_pack,
    ...input.signalPack.evidenceRefs,
    ...(input.trendReversalObservation?.evidenceRefs ?? []),
  ]);
}

function commonConfidence(input: BuildConstructedSignalSetV1Input): number | null {
  const values = [input.dataQuality.confidence, input.cqdSnapshot.confidence]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? clamp01(Math.min(...values)) : null;
}

export function deriveFragilitySignals(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalV1[] {
  const liquidity = input.signalPack.liquidity;
  const market = input.signalPack.marketStructure;
  const trend = input.trendReversalObservation;
  const refs = evidenceRefs(input);
  const confidence = commonConfidence(input);

  return [
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "liquidity_fragility",
      direction: "bearish",
      strength:
        liquidity.liquidityScore !== null ||
        liquidity.liquidityUsd !== null ||
        liquidity.spreadPct !== null ||
        trend?.riskSignals.liquidityDrop === true
          ? trend?.riskSignals.liquidityDrop === true
            ? 0.8
            : 0.45
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(liquidity.liquidityScore === null ? ["signalPack.liquidity.liquidityScore"] : []),
        ...(liquidity.liquidityUsd === null ? ["signalPack.liquidity.liquidityUsd"] : []),
        ...(liquidity.spreadPct === null ? ["signalPack.liquidity.spreadPct"] : []),
        ...(trend?.riskSignals.liquidityDrop === null
          ? ["trendReversalObservation.riskSignals.liquidityDrop"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(liquidity.liquidityScore !== null ? ["basis:liquidity_score"] : []),
        ...(liquidity.liquidityUsd !== null ? ["basis:liquidity_usd"] : []),
        ...(liquidity.spreadPct !== null ? ["basis:spread_pct"] : []),
        ...(trend?.riskSignals.liquidityDrop === true ? ["worker_liquidity_drop:true"] : []),
      ]),
      status: supportStatus([
        liquidity.liquidityScore,
        liquidity.liquidityUsd,
        liquidity.spreadPct,
        trend?.riskSignals.liquidityDrop,
      ]),
    }),
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "downside_continuation_risk",
      direction: "bearish",
      strength:
        market.drawdownPct !== null ||
        market.priceReturnPct !== null ||
        trend?.riskSignals.exhaustionWickPattern === true ||
        trend?.state === "invalidated"
          ? trend?.state === "invalidated" || trend?.riskSignals.exhaustionWickPattern === true
            ? 0.85
            : 0.5
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(market.drawdownPct === null ? ["signalPack.marketStructure.drawdownPct"] : []),
        ...(market.priceReturnPct === null ? ["signalPack.marketStructure.priceReturnPct"] : []),
        ...(trend?.riskSignals.exhaustionWickPattern === null
          ? ["trendReversalObservation.riskSignals.exhaustionWickPattern"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(market.drawdownPct !== null ? ["basis:drawdown_pct"] : []),
        ...(market.priceReturnPct !== null ? ["basis:price_return_pct"] : []),
        ...(trend?.riskSignals.exhaustionWickPattern === true
          ? ["worker_exhaustion_wick_pattern:true"]
          : []),
        ...(trend?.state === "invalidated" ? ["worker_state:invalidated"] : []),
        ...(trend?.state === "weak_reclaim" ? ["worker_state:weak_reclaim"] : []),
      ]),
      status: supportStatus([
        market.drawdownPct,
        market.priceReturnPct,
        trend?.riskSignals.exhaustionWickPattern,
      ]),
    }),
  ];
}
