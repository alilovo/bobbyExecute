import { hashDecision, hashResult } from "../../core/determinism/hash.js";
import type { JournalEntry } from "../../core/contracts/journal.js";
import { appendJournal } from "../../persistence/journal-repository.js";
import type { JournalWriter } from "../../journal-writer/writer.js";
import type {
  WorkerEventEnvelope,
  WorkerEventGateState,
  WorkerEventNormalization,
  WorkerGateStageName,
} from "./contracts.js";
import type {
  WorkerGateStageResult,
} from "./engine.js";
import type {
  WorkerEventGateEvaluationResult,
  WorkerModelResultPlaceholder,
  WorkerModelRoutingDecision,
  WorkerSuppressionRecord,
  WorkerWriteEffectDecision,
} from "./engine.js";
import { WORKER_GATE_STAGE_ORDER } from "./engine.js";

export const WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION = "worker.event.gate.journal.v1" as const;

const JOURNAL_STAGE_EVENT = "worker.event";
const JOURNAL_STAGE_GATE_PREFIX = "worker.gate";
const JOURNAL_STAGE_SUPPRESSION = "worker.suppression";
const JOURNAL_STAGE_ROUTING = "worker.routing";
const JOURNAL_STAGE_MODEL_RESULT = "worker.model_result";
const JOURNAL_STAGE_WRITE_EFFECT = "worker.write_effect";

export interface WorkerJournalEventRecord {
  recordType: "event";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  event: WorkerEventEnvelope;
  normalization: WorkerEventNormalization;
  stateBefore: WorkerEventGateState;
  stageOrder: readonly WorkerGateStageName[];
  evaluationHash: string;
  replayKey: string;
}

export interface WorkerJournalGateRecord {
  recordType: "gate";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  stage: WorkerGateStageName;
  result: WorkerGateStageResult;
  evaluationHash: string;
}

export interface WorkerJournalSuppressionRecord {
  recordType: "suppression";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  stage: WorkerGateStageName;
  blockingStage?: WorkerGateStageName;
  suppression: WorkerSuppressionRecord;
  evaluationHash: string;
}

export interface WorkerJournalRoutingRecord {
  recordType: "routing";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  routing: WorkerModelRoutingDecision;
  evaluationHash: string;
}

export interface WorkerJournalModelResultRecord {
  recordType: "model_result";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  modelResult: WorkerModelResultPlaceholder;
  evaluationHash: string;
}

export interface WorkerJournalWriteEffectRecord {
  recordType: "write_effect";
  schemaVersion: typeof WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION;
  traceId: string;
  timestamp: string;
  writeEffect: WorkerWriteEffectDecision;
  evaluationHash: string;
}

export type WorkerJournalRecord =
  | WorkerJournalEventRecord
  | WorkerJournalGateRecord
  | WorkerJournalSuppressionRecord
  | WorkerJournalRoutingRecord
  | WorkerJournalModelResultRecord
  | WorkerJournalWriteEffectRecord;

export interface WorkerEventGateReplayTrace {
  event: WorkerEventEnvelope | null;
  normalization: WorkerEventNormalization | null;
  gatePath: WorkerGateStageResult[];
  suppression?: WorkerSuppressionRecord;
  routing?: WorkerModelRoutingDecision;
  modelResult?: WorkerModelResultPlaceholder;
  writeEffect?: WorkerWriteEffectDecision;
  blocked: boolean;
  blockingStage?: WorkerGateStageName;
  terminalStage?: WorkerGateStageName;
  journalEntries: JournalEntry[];
}

function toJournalEntry(
  traceId: string,
  timestamp: string,
  stage: string,
  input: unknown,
  output: unknown,
  blocked = false,
  reason?: string,
  prevEventHash?: string
): JournalEntry {
  const decisionHash = hashDecision(input);
  const resultHash = hashResult(output);
  const eventHash = hashResult({
    traceId,
    timestamp,
    stage,
    decisionHash,
    resultHash,
    blocked,
    reason,
    prevEventHash,
  });

  return {
    traceId,
    timestamp,
    stage,
    decisionHash,
    resultHash,
    input,
    output,
    blocked,
    reason,
    eventHash,
    prevEventHash,
  };
}

function gateStageJournalName(stage: WorkerGateStageName): string {
  return `${JOURNAL_STAGE_GATE_PREFIX}.${stage}`;
}

export function buildWorkerEventGateJournalRecords(
  evaluation: WorkerEventGateEvaluationResult
): WorkerJournalRecord[] {
  const records: WorkerJournalRecord[] = [
    {
      recordType: "event",
      schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
      traceId: evaluation.traceId,
      timestamp: evaluation.event.observedAt,
      event: evaluation.event,
      normalization: evaluation.normalization,
      stateBefore: evaluation.stateBefore,
      stageOrder: WORKER_GATE_STAGE_ORDER,
      evaluationHash: evaluation.evaluationHash,
      replayKey: evaluation.replayKey,
    },
  ];

  for (const result of evaluation.stages) {
    records.push({
      recordType: "gate",
      schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
      traceId: evaluation.traceId,
      timestamp: evaluation.event.observedAt,
      stage: result.stage,
      result,
      evaluationHash: hashResult({
        traceId: evaluation.traceId,
        stage: result.stage,
        disposition: result.disposition,
        reasonClass: result.reasonClass,
        basisHash: result.basisHash,
      }),
    });
  }

  if (evaluation.suppression) {
    records.push({
      recordType: "suppression",
      schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
      traceId: evaluation.traceId,
      timestamp: evaluation.event.observedAt,
      stage: evaluation.blockingStage ?? evaluation.terminalStage,
      blockingStage: evaluation.blockingStage,
      suppression: evaluation.suppression,
      evaluationHash: hashResult({
        traceId: evaluation.traceId,
        suppression: evaluation.suppression,
        blockingStage: evaluation.blockingStage,
      }),
    });
  }

  records.push({
    recordType: "routing",
    schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
    traceId: evaluation.traceId,
    timestamp: evaluation.event.observedAt,
    routing: evaluation.routing,
    evaluationHash: hashResult({
      traceId: evaluation.traceId,
      routing: evaluation.routing,
    }),
  });

  records.push({
    recordType: "model_result",
    schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
    traceId: evaluation.traceId,
    timestamp: evaluation.event.observedAt,
    modelResult: evaluation.modelResult,
    evaluationHash: hashResult({
      traceId: evaluation.traceId,
      modelResult: evaluation.modelResult,
    }),
  });

  records.push({
    recordType: "write_effect",
    schemaVersion: WORKER_EVENT_GATE_JOURNAL_SCHEMA_VERSION,
    traceId: evaluation.traceId,
    timestamp: evaluation.event.observedAt,
    writeEffect: evaluation.writeEffect,
    evaluationHash: hashResult({
      traceId: evaluation.traceId,
      writeEffect: evaluation.writeEffect,
    }),
  });

  return records;
}

export function buildWorkerEventGateJournalEntries(
  evaluation: WorkerEventGateEvaluationResult
): JournalEntry[] {
  const records = buildWorkerEventGateJournalRecords(evaluation);
  const entries: JournalEntry[] = [];
  let prevEventHash: string | undefined;

  for (const record of records) {
    const entry = (() => {
      switch (record.recordType) {
        case "event":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            JOURNAL_STAGE_EVENT,
            {
              schemaVersion: record.schemaVersion,
              event: record.event,
              normalization: record.normalization,
              stateBefore: record.stateBefore,
              stageOrder: record.stageOrder,
              evaluationHash: record.evaluationHash,
              replayKey: record.replayKey,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              event: record.event,
              normalization: record.normalization,
              stateBefore: record.stateBefore,
              stageOrder: record.stageOrder,
              evaluationHash: record.evaluationHash,
              replayKey: record.replayKey,
            },
            false,
            undefined,
            prevEventHash
          );
        case "gate":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            gateStageJournalName(record.stage),
            {
              stage: record.stage,
              result: record.result,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              stage: record.stage,
              result: record.result,
              evaluationHash: record.evaluationHash,
            },
            record.result.blocked,
            record.result.suppressed ? record.result.suppression?.reasonClass : record.result.reasonClass,
            prevEventHash
          );
        case "suppression":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            JOURNAL_STAGE_SUPPRESSION,
            {
              stage: record.stage,
              blockingStage: record.blockingStage,
              suppression: record.suppression,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              stage: record.stage,
              blockingStage: record.blockingStage,
              suppression: record.suppression,
              evaluationHash: record.evaluationHash,
            },
            true,
            record.suppression.reasonClass,
            prevEventHash
          );
        case "routing":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            JOURNAL_STAGE_ROUTING,
            {
              routing: record.routing,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              routing: record.routing,
              evaluationHash: record.evaluationHash,
            },
            false,
            record.routing.reasonClass,
            prevEventHash
          );
        case "model_result":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            JOURNAL_STAGE_MODEL_RESULT,
            {
              modelResult: record.modelResult,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              modelResult: record.modelResult,
              evaluationHash: record.evaluationHash,
            },
            false,
            record.modelResult.reasonClass,
            prevEventHash
          );
        case "write_effect":
          return toJournalEntry(
            record.traceId,
            record.timestamp,
            JOURNAL_STAGE_WRITE_EFFECT,
            {
              writeEffect: record.writeEffect,
            },
            {
              recordType: record.recordType,
              schemaVersion: record.schemaVersion,
              writeEffect: record.writeEffect,
              evaluationHash: record.evaluationHash,
            },
            false,
            record.writeEffect.reasonClass,
            prevEventHash
          );
        default: {
          const exhaustiveCheck: never = record;
          throw new Error(`UNHANDLED_WORKER_JOURNAL_RECORD:${String(exhaustiveCheck)}`);
        }
      }
    })();

    entries.push(entry);
    prevEventHash = entry.eventHash;
  }

  return entries;
}

export async function appendWorkerEventGateJournal(
  writer: JournalWriter,
  evaluation: WorkerEventGateEvaluationResult
): Promise<JournalEntry[]> {
  const entries = buildWorkerEventGateJournalEntries(evaluation);
  for (const entry of entries) {
    await appendJournal(writer, entry);
  }
  return entries;
}

function parseRecord(output: unknown): WorkerJournalRecord | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const recordType = (output as { recordType?: unknown }).recordType;
  if (recordType === "event") {
    return output as WorkerJournalEventRecord;
  }
  if (recordType === "gate") {
    return output as WorkerJournalGateRecord;
  }
  if (recordType === "suppression") {
    return output as WorkerJournalSuppressionRecord;
  }
  if (recordType === "routing") {
    return output as WorkerJournalRoutingRecord;
  }
  if (recordType === "model_result") {
    return output as WorkerJournalModelResultRecord;
  }
  if (recordType === "write_effect") {
    return output as WorkerJournalWriteEffectRecord;
  }
  return null;
}

export function reconstructWorkerEventGateReplay(entries: ReadonlyArray<JournalEntry>): WorkerEventGateReplayTrace {
  const replay: WorkerEventGateReplayTrace = {
    event: null,
    normalization: null,
    gatePath: [],
    blocked: false,
    journalEntries: [...entries],
  };
  let terminalStage: WorkerGateStageName | undefined;

  for (const entry of entries) {
    const record = parseRecord(entry.output);
    if (!record) {
      continue;
    }

    if (record.recordType === "event") {
      replay.event = record.event;
      replay.normalization = record.normalization;
      continue;
    }

    if (record.recordType === "gate") {
      replay.gatePath.push(record.result);
      if (record.result.blocked) {
        replay.blocked = true;
        replay.blockingStage = record.result.stage;
        terminalStage = record.result.stage;
      }
      continue;
    }

    if (record.recordType === "suppression") {
      replay.suppression = record.suppression;
      replay.blocked = true;
      replay.blockingStage = record.blockingStage ?? record.stage;
      terminalStage = record.blockingStage ?? record.stage;
      continue;
    }

    if (record.recordType === "routing") {
      replay.routing = record.routing;
      continue;
    }

    if (record.recordType === "model_result") {
      replay.modelResult = record.modelResult;
      continue;
    }

    if (record.recordType === "write_effect") {
      replay.writeEffect = record.writeEffect;
    }
  }

  replay.terminalStage = terminalStage ?? replay.gatePath.at(-1)?.stage;
  return replay;
}
