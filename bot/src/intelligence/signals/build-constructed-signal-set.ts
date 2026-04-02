/**
 * Deterministic constructed-signal bridge.
 * Consolidates pre-authority observations into descriptive signal descriptors only.
 */
import type { DataQualityV1 } from "../quality/contracts/data-quality.v1.js";
import type { CQDSnapshotV1 } from "../cqd/contracts/cqd.snapshot.v1.js";
import type { SignalPackV1 } from "../forensics/contracts/signal-pack.v1.js";
import type { TrendReversalObservationV1 } from "../forensics/contracts/trend-reversal-observation.v1.js";
import { hashPayload, sortRecord, uniqueSorted } from "../forensics/deterministic.js";
import {
  ConstructedSignalSetSourceCoverageEntrySchema,
  ConstructedSignalSetV1Schema,
  type ConstructedSignalSetBuildStatus,
  type ConstructedSignalSetSourceCoverageEntry,
  type ConstructedSignalSetV1,
  type ConstructedSignalType,
  type ConstructedSignalV1,
} from "./contracts/index.js";
import { deriveFragilitySignals } from "./derive-fragility-signals.js";
import { deriveManipulationSignals } from "./derive-manipulation-signals.js";
import { deriveParticipationSignals } from "./derive-participation-signals.js";
import { deriveStructureSignals } from "./derive-structure-signals.js";

export {
  deriveFragilitySignals,
  deriveManipulationSignals,
  deriveParticipationSignals,
  deriveStructureSignals,
};

export interface ConstructedSignalSetContextAvailability {
  supplementalHintsAvailable: boolean;
  missingSupplementalHints: readonly string[];
}

export interface BuildConstructedSignalSetV1Input {
  token: string;
  chain?: "solana";
  traceId: string;
  timestamp?: string;
  dataQuality: DataQualityV1;
  cqdSnapshot: CQDSnapshotV1;
  signalPack: SignalPackV1;
  trendReversalObservation?: TrendReversalObservationV1 | null;
  contextAvailability?: Partial<ConstructedSignalSetContextAvailability>;
  evidenceRefs?: readonly string[];
  notes?: readonly string[];
}

const SIGNAL_ORDER: readonly ConstructedSignalType[] = [
  "structure_weakness",
  "reclaim_attempt",
  "possible_structure_shift",
  "participation_improvement",
  "liquidity_fragility",
  "manipulation_caution",
  "downside_continuation_risk",
];

function buildTimestamp(input: BuildConstructedSignalSetV1Input): number {
  const timestamp = input.timestamp ?? input.dataQuality.timestamp;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function collectInputRefs(input: BuildConstructedSignalSetV1Input): string[] {
  return uniqueSorted([
    `data_quality:${input.dataQuality.traceId}`,
    `cqd:${input.cqdSnapshot.hash}`,
    `signal_pack:${input.signalPack.payloadHash}`,
    ...(input.trendReversalObservation
      ? [`trend_reversal_observation:${input.trendReversalObservation.inputRef}`]
      : []),
  ]);
}

function collectEvidenceRefs(input: BuildConstructedSignalSetV1Input): string[] {
  return uniqueSorted([
    ...(input.evidenceRefs ?? []),
    ...input.cqdSnapshot.evidence_pack,
    ...input.signalPack.evidenceRefs,
    ...(input.trendReversalObservation?.evidenceRefs ?? []),
  ]);
}

function mergeCoverageStatus(statuses: readonly (string | null | undefined)[]): string {
  const values = statuses.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (values.length === 0) {
    return "MISSING";
  }

  for (const candidate of ["ERROR", "STALE", "DEGRADED", "PARTIAL", "MISSING", "OK"]) {
    if (values.includes(candidate)) {
      return candidate;
    }
  }

  return uniqueSorted(values)[0] ?? "MISSING";
}

function deriveSourceCoverage(
  input: BuildConstructedSignalSetV1Input
): Record<string, ConstructedSignalSetSourceCoverageEntry> {
  const sources = uniqueSorted([
    ...Object.keys(input.dataQuality.source_breakdown),
    ...(input.cqdSnapshot.source_summaries ?? []).map((summary) => summary.source),
    ...Object.keys(input.signalPack.sourceCoverage),
    ...(input.trendReversalObservation ? Object.keys(input.trendReversalObservation.sourceCoverage) : []),
  ]);

  return sortRecord(
    Object.fromEntries(
      sources.map((source) => {
        const qualityEntry = input.dataQuality.source_breakdown[source];
        const cqdSummary = (input.cqdSnapshot.source_summaries ?? []).find(
          (summary) => summary.source === source
        );
        const signalEntry = input.signalPack.sourceCoverage[source];
        const trendEntry = input.trendReversalObservation?.sourceCoverage[source];
        const status = mergeCoverageStatus([
          signalEntry?.status,
          trendEntry?.status,
          cqdSummary?.status,
          qualityEntry
            ? qualityEntry.completeness === 1 && qualityEntry.freshness === 1
              ? "OK"
              : qualityEntry.completeness > 0 || qualityEntry.freshness > 0
                ? "PARTIAL"
                : "MISSING"
            : null,
        ]);

        return [
          source,
          ConstructedSignalSetSourceCoverageEntrySchema.parse({
            status,
            isStale:
              status === "STALE" ||
              input.dataQuality.staleSources.includes(source) ||
              trendEntry?.isStale === true,
          }),
        ];
      })
    )
  );
}

function collectMissingInputs(
  input: BuildConstructedSignalSetV1Input,
  signals: ConstructedSignalV1[],
  buildStatus: ConstructedSignalSetBuildStatus,
  buildIssues: readonly string[]
): string[] {
  const missing = new Set<string>([
    ...input.dataQuality.missingCriticalFields,
    ...input.signalPack.missingFields,
    ...(input.trendReversalObservation?.missingFields ?? []),
    ...buildIssues,
  ]);

  if (!input.trendReversalObservation) {
    missing.add("trendReversalObservation");
  }

  if (!input.contextAvailability?.supplementalHintsAvailable) {
    missing.add("contextAvailability.supplementalHints");
  }

  if (buildStatus === "invalidated") {
    missing.add("buildStatus.invalidated");
  }

  for (const signal of signals) {
    for (const missingInput of signal.missingInputs) {
      missing.add(missingInput);
    }
  }

  return uniqueSorted([...missing]);
}

function collectBuildIssues(input: BuildConstructedSignalSetV1Input): string[] {
  const issues = new Set<string>();

  if (input.dataQuality.status === "fail") {
    issues.add("dataQuality.status");
  }

  if (input.signalPack.chain !== input.chain && input.chain !== undefined) {
    issues.add("signalPack.chain");
  }

  if (input.cqdSnapshot.chain !== input.chain && input.chain !== undefined) {
    issues.add("cqdSnapshot.chain");
  }

  if (input.signalPack.token !== input.token) {
    issues.add("signalPack.token");
  }

  if (input.cqdSnapshot.token !== input.token) {
    issues.add("cqdSnapshot.token");
  }

  if (input.signalPack.dataQualityTraceId !== input.dataQuality.traceId) {
    issues.add("signalPack.dataQualityTraceId");
  }

  if (input.signalPack.cqdHash !== input.cqdSnapshot.hash) {
    issues.add("signalPack.cqdHash");
  }

  if (
    input.trendReversalObservation &&
    input.trendReversalObservation.token !== input.token
  ) {
    issues.add("trendReversalObservation.token");
  }

  if (
    input.trendReversalObservation &&
    input.trendReversalObservation.chain !== (input.chain ?? "solana")
  ) {
    issues.add("trendReversalObservation.chain");
  }

  return uniqueSorted([...issues]);
}

function buildSignalSetSignals(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalV1[] {
  const signals = [
    ...deriveStructureSignals(input),
    ...deriveParticipationSignals(input),
    ...deriveFragilitySignals(input),
    ...deriveManipulationSignals(input),
  ];

  return signals.sort((left, right) => {
    const leftIndex = SIGNAL_ORDER.indexOf(left.signalType);
    const rightIndex = SIGNAL_ORDER.indexOf(right.signalType);
    return leftIndex - rightIndex || left.direction.localeCompare(right.direction);
  });
}

export function buildConstructedSignalSetV1(
  input: BuildConstructedSignalSetV1Input
): ConstructedSignalSetV1 {
  const buildIssues = collectBuildIssues(input);
  const buildStatus: ConstructedSignalSetBuildStatus =
    buildIssues.length > 0
      ? "invalidated"
      : !input.trendReversalObservation || !input.contextAvailability?.supplementalHintsAvailable
        ? "degraded"
        : "built";
  const signals = buildStatus === "invalidated" ? [] : buildSignalSetSignals(input);
  const sourceCoverage = deriveSourceCoverage(input);
  const evidenceRefs = collectEvidenceRefs(input);
  const inputRefs = collectInputRefs(input);
  const createdAtMs = buildTimestamp(input);
  const missingInputs = collectMissingInputs(input, signals, buildStatus, buildIssues);
  const payload = {
    schema_version: "constructed_signal_set.v1" as const,
    token: input.token,
    chain: input.chain ?? "solana",
    inputRefs,
    signals,
    missingInputs,
    evidenceRefs,
    sourceCoverage,
    buildStatus,
    createdAtMs,
  };

  return ConstructedSignalSetV1Schema.parse({
    ...payload,
    payloadHash: hashPayload(payload),
  });
}
