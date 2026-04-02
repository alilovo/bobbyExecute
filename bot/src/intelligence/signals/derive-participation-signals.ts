/**
 * Participation-family signal derivation.
 * Observational only; no execution or policy semantics.
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

export function deriveParticipationSignals(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalV1[] {
  const volume = input.signalPack.volume;
  const holderFlow = input.signalPack.holderFlow;
  const trend = input.trendReversalObservation;
  const refs = evidenceRefs(input);
  const confidence = (() => {
    const values = [input.dataQuality.confidence, input.cqdSnapshot.confidence]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return values.length > 0 ? clamp01(Math.min(...values)) : null;
  })();

  return [
    ConstructedSignalV1Schema.parse({
      schema_version: "constructed_signal.v1",
      signalType: "participation_improvement",
      direction: "bullish",
      strength:
        volume.relativeVolumePct !== null ||
        volume.volumeMomentumPct !== null ||
        holderFlow.netFlowUsd !== null ||
        trend?.participationSignals.buyerStrengthIncreasing === true
          ? trend?.participationSignals.buyerStrengthIncreasing === true
            ? 0.8
            : 0.5
          : null,
      confidence,
      evidenceRefs: refs,
      missingInputs: uniqueSorted([
        ...(volume.relativeVolumePct === null ? ["signalPack.volume.relativeVolumePct"] : []),
        ...(volume.volumeMomentumPct === null ? ["signalPack.volume.volumeMomentumPct"] : []),
        ...(holderFlow.netFlowUsd === null ? ["signalPack.holderFlow.netFlowUsd"] : []),
        ...(trend?.participationSignals.buyerStrengthIncreasing === null
          ? ["trendReversalObservation.participationSignals.buyerStrengthIncreasing"]
          : []),
      ]),
      notes: uniqueSorted([
        ...(volume.relativeVolumePct !== null ? ["basis:relative_volume_pct"] : []),
        ...(volume.volumeMomentumPct !== null ? ["basis:volume_momentum_pct"] : []),
        ...(holderFlow.netFlowUsd !== null ? ["basis:net_flow_usd"] : []),
        ...(trend?.participationSignals.volumeExpansion === true ? ["worker_volume_expansion:true"] : []),
        ...(trend?.participationSignals.buyerStrengthIncreasing === true
          ? ["worker_buyer_strength_increasing:true"]
          : []),
      ]),
      status: supportStatus([
        volume.relativeVolumePct,
        volume.volumeMomentumPct,
        holderFlow.netFlowUsd,
        trend?.participationSignals.buyerStrengthIncreasing,
      ]),
    }),
  ];
}
