/**
 * Deterministic scoring bridge.
 * Reduces constructed signals into pre-decision score cards only.
 */
import type { ConstructedSignalType } from "../signals/contracts/constructed-signal.v1.js";
import { ConstructedSignalSetV1Schema, type ConstructedSignalSetV1 } from "../signals/contracts/index.js";
import { hashPayload, sortRecord, uniqueSorted } from "../forensics/deterministic.js";
import {
  ScoreCardV1Schema,
  type ScoreCardAggregateScores,
  type ScoreCardBuildStatus,
  type ScoreCardV1,
  type ScoreComponentId,
  type ScoreComponentStatus,
  type ScoreComponentV1,
  ScoreComponentV1Schema,
} from "./contracts/index.js";

export interface BuildScoreCardV1Input {
  constructedSignalSet: ConstructedSignalSetV1;
}

interface ComponentDefinition {
  componentId: ScoreComponentId;
  signalTypes: readonly ConstructedSignalType[];
  polarity: Partial<Record<ConstructedSignalType, -1 | 1>>;
}

const SCORE_MODEL_ID = "constructed_signal_score_v1";
const SCORE_MODEL_VERSION = "1.0.0";

const COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  {
    componentId: "structure",
    signalTypes: [
      "structure_weakness",
      "reclaim_attempt",
      "possible_structure_shift",
    ],
    polarity: {
      structure_weakness: -1,
      reclaim_attempt: 1,
      possible_structure_shift: 1,
    },
  },
  {
    componentId: "participation",
    signalTypes: ["participation_improvement"],
    polarity: {
      participation_improvement: 1,
    },
  },
  {
    componentId: "fragility",
    signalTypes: ["liquidity_fragility"],
    polarity: {
      liquidity_fragility: -1,
    },
  },
  {
    componentId: "manipulation_caution",
    signalTypes: ["manipulation_caution"],
    polarity: {
      manipulation_caution: -1,
    },
  },
  {
    componentId: "reversal_quality",
    signalTypes: [
      "reclaim_attempt",
      "possible_structure_shift",
      "participation_improvement",
    ],
    polarity: {
      reclaim_attempt: 1,
      possible_structure_shift: 1,
      participation_improvement: 1,
    },
  },
  {
    componentId: "downside_continuation_risk",
    signalTypes: [
      "downside_continuation_risk",
      "structure_weakness",
      "liquidity_fragility",
      "manipulation_caution",
    ],
    polarity: {
      downside_continuation_risk: -1,
      structure_weakness: -1,
      liquidity_fragility: -1,
      manipulation_caution: -1,
    },
  },
] as const;

const CONSTRUCTIVE_GROUP: readonly ScoreComponentId[] = [
  "structure",
  "participation",
  "reversal_quality",
];
const RISK_GROUP: readonly ScoreComponentId[] = [
  "fragility",
  "manipulation_caution",
  "downside_continuation_risk",
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isDefinedSignal(
  signal: ConstructedSignalSetV1["signals"][number] | undefined
): signal is ConstructedSignalSetV1["signals"][number] {
  return signal !== undefined;
}

function isFiniteScoredSignal(
  signal: ConstructedSignalSetV1["signals"][number]
): signal is ConstructedSignalSetV1["signals"][number] & { strength: number } {
  return typeof signal.strength === "number" && Number.isFinite(signal.strength);
}

function sortSourceCoverage(
  sourceCoverage: ConstructedSignalSetV1["sourceCoverage"]
): ConstructedSignalSetV1["sourceCoverage"] {
  return sortRecord(sourceCoverage);
}

function buildSignalIndex(
  signalSet: ConstructedSignalSetV1
): Map<ConstructedSignalType, ConstructedSignalSetV1["signals"][number]> {
  return new Map(signalSet.signals.map((signal) => [signal.signalType, signal]));
}

function signedStrength(
  signalType: ConstructedSignalType,
  strength: number,
  polarity: Partial<Record<ConstructedSignalType, -1 | 1>>
): number {
  return strength * (polarity[signalType] ?? 1);
}

function deriveComponentScore(
  definition: ComponentDefinition,
  signalSet: ConstructedSignalSetV1,
  signalIndex: Map<ConstructedSignalType, ConstructedSignalSetV1["signals"][number]>
): ScoreComponentV1 {
  const matchingSignals = definition.signalTypes
    .map((signalType) => signalIndex.get(signalType))
    .filter(isDefinedSignal);
  const contributingSignals = matchingSignals.filter(isFiniteScoredSignal);
  const expectedCount = definition.signalTypes.length;
  const presentCount = matchingSignals.length;
  const contributingCount = contributingSignals.length;
  const coverage = expectedCount > 0 ? contributingCount / expectedCount : 0;
  const sourceSignalTypes = definition.signalTypes.filter((signalType) =>
    signalIndex.has(signalType)
  );
  const evidenceRefs = uniqueSorted([
    ...signalSet.evidenceRefs,
    ...matchingSignals.flatMap((signal) => signal.evidenceRefs),
  ]);
  const missingInputs = uniqueSorted([
    ...signalSet.missingInputs,
    ...definition.signalTypes
      .filter((signalType) => !signalIndex.has(signalType))
      .map((signalType) => `constructedSignalSet.signal.${signalType}`),
    ...matchingSignals.flatMap((signal) => signal.missingInputs),
  ]);
  const notes = uniqueSorted([
    `component:${definition.componentId}`,
    ...(matchingSignals.length > 0
      ? matchingSignals.map((signal) => `basis:${signal.signalType}`)
      : []),
    ...(presentCount > 0
      ? [`coverage:${contributingCount}/${expectedCount}`]
      : [`coverage:0/${expectedCount}`]),
  ]);

  if (presentCount === 0) {
    return ScoreComponentV1Schema.parse({
      schema_version: "score_component.v1",
      componentId: definition.componentId,
      score: null,
      confidence: null,
      sourceSignalTypes,
      evidenceRefs,
      missingInputs,
      notes,
      status: "missing" as ScoreComponentStatus,
    });
  }

  const scores = contributingSignals.map((signal) => {
    return signedStrength(signal.signalType, signal.strength, definition.polarity);
  });
  const confidenceValues = contributingSignals
    .map((signal) => signal.confidence)
    .filter((confidence): confidence is number =>
      typeof confidence === "number" && Number.isFinite(confidence)
    );
  const meanScore = mean(scores);
  const meanConfidence = mean(confidenceValues);
  const score = meanScore === null ? null : clampSigned(meanScore * coverage);
  const confidence =
    meanConfidence === null ? null : clamp01(meanConfidence * coverage);
  const status: ScoreComponentStatus =
    presentCount === expectedCount && contributingCount === expectedCount
      ? "present"
      : "partial";

  return ScoreComponentV1Schema.parse({
    schema_version: "score_component.v1",
    componentId: definition.componentId,
    score,
    confidence,
    sourceSignalTypes,
    evidenceRefs,
    missingInputs,
    notes,
    status,
  });
}

function deriveAggregateScores(
  componentScores: ScoreComponentV1[]
): ScoreCardAggregateScores {
  const componentById = new Map(
    componentScores.map((component) => [component.componentId, component])
  );

  const constructive = mean(
    CONSTRUCTIVE_GROUP
      .map((componentId) => componentById.get(componentId)?.score ?? null)
      .filter((value): value is number => typeof value === "number")
  );
  const riskPressure = mean(
    RISK_GROUP
      .map((componentId) => componentById.get(componentId)?.score ?? null)
      .filter((value): value is number => typeof value === "number")
  );
  const composite = mean(
    componentScores
      .map((component) => component.score)
      .filter((value): value is number => typeof value === "number")
  );

  return {
    constructive: constructive === null ? null : clampSigned(constructive),
    riskPressure: riskPressure === null ? null : clampSigned(riskPressure),
    composite: composite === null ? null : clampSigned(composite),
  };
}

function deriveConfidence(
  componentScores: ScoreComponentV1[],
  buildStatus: ScoreCardBuildStatus
): number | null {
  if (buildStatus === "invalidated") {
    return null;
  }

  const scoredComponents = componentScores.filter(
    (component) =>
      (component.status === "present" || component.status === "partial") &&
      typeof component.confidence === "number"
  );

  if (scoredComponents.length === 0) {
    return null;
  }

  const confidenceMean = mean(
    scoredComponents.map((component) => component.confidence as number)
  );
  const coverage = scoredComponents.length / componentScores.length;

  return confidenceMean === null ? null : clamp01(confidenceMean * coverage);
}

function deriveBuildStatus(input: {
  signalSet: ConstructedSignalSetV1;
  componentScores: ScoreComponentV1[];
}): ScoreCardBuildStatus {
  if (input.signalSet.buildStatus === "invalidated") {
    return "invalidated";
  }

  if (input.signalSet.buildStatus === "degraded") {
    return "degraded";
  }

  const hasIncompleteComponent = input.componentScores.some(
    (component) => component.status !== "present"
  );

  return hasIncompleteComponent ? "degraded" : "built";
}

export function buildScoreCardV1(input: BuildScoreCardV1Input): ScoreCardV1 {
  const signalSet = ConstructedSignalSetV1Schema.parse(input.constructedSignalSet);
  const signalIndex = buildSignalIndex(signalSet);
  const componentScores = COMPONENT_DEFINITIONS.map((definition) =>
    deriveComponentScore(definition, signalSet, signalIndex)
  );
  const buildStatus = deriveBuildStatus({ signalSet, componentScores });
  const aggregateScores =
    buildStatus === "invalidated"
      ? {
          constructive: null,
          riskPressure: null,
          composite: null,
        }
      : deriveAggregateScores(componentScores);
  const inputRefs = uniqueSorted([
    ...signalSet.inputRefs,
    `constructed_signal_set:${signalSet.payloadHash}`,
  ]);
  const evidenceRefs = uniqueSorted([
    ...signalSet.evidenceRefs,
    ...componentScores.flatMap((component) => component.evidenceRefs),
  ]);
  const missingInputs = uniqueSorted([
    ...signalSet.missingInputs,
    ...componentScores.flatMap((component) => component.missingInputs),
    ...(buildStatus === "invalidated" ? ["scoreCard.buildStatus.invalidated"] : []),
  ]);
  const confidence = deriveConfidence(componentScores, buildStatus);
  const payload = {
    schema_version: "score_card.v1" as const,
    token: signalSet.token,
    chain: signalSet.chain,
    scoringModelId: SCORE_MODEL_ID,
    scoringModelVersion: SCORE_MODEL_VERSION,
    componentScores,
    aggregateScores,
    confidence,
    inputRefs,
    evidenceRefs,
    missingInputs,
    sourceCoverage: sortSourceCoverage(signalSet.sourceCoverage),
    buildStatus,
    createdAtMs: signalSet.createdAtMs,
  };

  return ScoreCardV1Schema.parse({
    ...payload,
    payloadHash: hashPayload(payload),
  });
}
