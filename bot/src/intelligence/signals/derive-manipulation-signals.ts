/**
 * Manipulation-family signal derivation.
 * Explicitly descriptive and non-authoritative.
 */
import { clamp01, uniqueSorted } from "../forensics/deterministic.js";
import type { BuildConstructedSignalSetV1Input } from "./build-constructed-signal-set.js";
import {
  ConstructedSignalV1Schema,
  type ConstructedSignalV1,
} from "./contracts/index.js";

function supportStatus(values: readonly (boolean | null | undefined)[]): "present" | "partial" | "missing" {
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

export function deriveManipulationSignals(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalV1[] {
  const flags = input.signalPack.manipulationFlags;
  const trend = input.trendReversalObservation;
  const refs = evidenceRefs(input);
  const confidence = commonConfidence(input);

  return [
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "manipulation_caution",
      direction: "bearish",
      strength:
        flags.washTradingSuspected === true ||
        flags.spoofingSuspected === true ||
        flags.concentrationFragility === true ||
        flags.crossSourceDivergence === true ||
        trend?.riskSignals.distributionRisk === true
          ? trend?.riskSignals.distributionRisk === true
            ? 0.85
            : 0.6
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(flags.washTradingSuspected === null ? ["signalPack.manipulationFlags.washTradingSuspected"] : []),
        ...(flags.spoofingSuspected === null ? ["signalPack.manipulationFlags.spoofingSuspected"] : []),
        ...(flags.concentrationFragility === null ? ["signalPack.manipulationFlags.concentrationFragility"] : []),
        ...(flags.crossSourceDivergence === null ? ["signalPack.manipulationFlags.crossSourceDivergence"] : []),
        ...(trend?.riskSignals.distributionRisk === null
          ? ["trendReversalObservation.riskSignals.distributionRisk"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(flags.washTradingSuspected === true ? ["basis:wash_trading_suspected"] : []),
        ...(flags.spoofingSuspected === true ? ["basis:spoofing_suspected"] : []),
        ...(flags.concentrationFragility === true ? ["basis:concentration_fragility"] : []),
        ...(flags.staleSourceRisk === true ? ["basis:stale_source_risk"] : []),
        ...(flags.crossSourceDivergence === true ? ["basis:cross_source_divergence"] : []),
        ...(trend?.riskSignals.distributionRisk === true ? ["worker_distribution_risk:true"] : []),
      ]),
      status: supportStatus([
        flags.washTradingSuspected,
        flags.spoofingSuspected,
        flags.concentrationFragility,
        flags.staleSourceRisk,
        flags.crossSourceDivergence,
        trend?.riskSignals.distributionRisk,
      ]),
    }),
  ];
}
