import { z } from "zod";
import { hashDecision, hashResult } from "../core/determinism/hash.js";
import type { JournalEntry } from "../core/contracts/journal.js";
import { JournalEntrySchema } from "../core/contracts/journal.js";
import {
  CASE_REQUIRED_SUBJECT_KINDS,
  CaseJournalRecordRefSchema,
  CaseSubjectRefSchema,
  CanonicalCaseRecordSchema,
  type CanonicalCaseRecord,
  type CanonicalCaseType,
  type CaseJournalRecordRef,
  type CaseSubjectRef,
} from "../core/contracts/casebook.js";
import { appendJournal } from "../persistence/journal-repository.js";
import type { JournalWriter } from "../journal-writer/writer.js";

export const CASEBOOK_CANONICAL_JOURNAL_SCHEMA_VERSION =
  "casebook.canonical_case.journal.v1" as const;
export const CASEBOOK_CANONICAL_JOURNAL_STAGE = "casebook.canonical_case" as const;

const CASEBOOK_BUILD_ERROR_PREFIX = "CASEBOOK_BUILD_FAILED" as const;

type CaseEvidenceCategory =
  | "event"
  | "gate"
  | "routing"
  | "transition"
  | "cadence"
  | "model_result"
  | "write_effect";

type CaseKnowledgePhase = "decision_time" | "outcome_time" | "review_time";

const DECISION_TIME_ALLOWED_CATEGORIES: ReadonlySet<CaseEvidenceCategory> = new Set([
  "event",
  "gate",
  "routing",
  "cadence",
]);
const OUTCOME_TIME_ALLOWED_CATEGORIES: ReadonlySet<CaseEvidenceCategory> = new Set([
  "transition",
  "write_effect",
]);
const REVIEW_TIME_ALLOWED_CATEGORIES: ReadonlySet<CaseEvidenceCategory> = new Set([
  "event",
  "gate",
  "routing",
  "transition",
  "cadence",
  "model_result",
  "write_effect",
]);

export interface CanonicalCaseAssemblyInput {
  case_type: CanonicalCaseType;
  trace_id: string;
  subject_refs: ReadonlyArray<CaseSubjectRef>;
  decision_time_journal_entries: ReadonlyArray<JournalEntry>;
  outcome_time_journal_entries: ReadonlyArray<JournalEntry>;
  review_time_journal_entries: ReadonlyArray<JournalEntry>;
  compressed_case_summary?: string;
  compressed_case_facts?: ReadonlyArray<string>;
  compressed_case_inferences?: ReadonlyArray<string>;
  compressed_case_lessons?: ReadonlyArray<string>;
  compression_version?: string;
}

export interface CanonicalCaseJournalRecord {
  recordType: "canonical_case";
  schemaVersion: typeof CASEBOOK_CANONICAL_JOURNAL_SCHEMA_VERSION;
  caseRecord: CanonicalCaseRecord;
  replayKey: string;
}

export const CanonicalCaseJournalRecordSchema = z
  .object({
    recordType: z.literal("canonical_case"),
    schemaVersion: z.literal(CASEBOOK_CANONICAL_JOURNAL_SCHEMA_VERSION),
    caseRecord: CanonicalCaseRecordSchema,
    replayKey: z.string().min(1),
  })
  .strict();

export interface CanonicalCaseReplayTrace {
  traceId: string | null;
  caseType: CanonicalCaseType | null;
  caseRecord: CanonicalCaseRecord | null;
  journalEntries: JournalEntry[];
}

function fail(details: string): never {
  throw new Error(`${CASEBOOK_BUILD_ERROR_PREFIX}:${details}`);
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareOptionalText(left: string | undefined, right: string | undefined): number {
  return compareText(left ?? "", right ?? "");
}

function compareJournalEntries(left: JournalEntry, right: JournalEntry): number {
  return (
    compareText(left.timestamp, right.timestamp) ||
    compareText(left.stage, right.stage) ||
    compareText(left.traceId, right.traceId) ||
    compareOptionalText(left.eventHash, right.eventHash) ||
    compareOptionalText(left.decisionHash, right.decisionHash) ||
    compareOptionalText(left.resultHash, right.resultHash)
  );
}

function canonicalizeJournalEntries(entries: ReadonlyArray<JournalEntry>, phase: CaseKnowledgePhase): JournalEntry[] {
  if (entries.length === 0) {
    fail(`${phase}:missing_entries`);
  }

  const normalized = entries.map((entry, index) => {
    const parsed = JournalEntrySchema.safeParse(entry);
    if (!parsed.success) {
      fail(`${phase}:invalid_journal_entry:${index}`);
    }
    if (!parsed.data.eventHash) {
      fail(`${phase}:missing_event_hash:${index}`);
    }
    return parsed.data;
  });

  normalized.sort(compareJournalEntries);
  return normalized;
}

function classifyJournalEntry(entry: JournalEntry): CaseEvidenceCategory | null {
  if (entry.stage === "worker.event") {
    return "event";
  }
  if (entry.stage.startsWith("worker.gate.") || entry.stage === "worker.suppression") {
    return "gate";
  }
  if (entry.stage === "worker.routing") {
    return "routing";
  }
  if (entry.stage.startsWith("worker.transition.")) {
    return "transition";
  }
  if (entry.stage === "worker.cadence.policy") {
    return "cadence";
  }
  if (entry.stage === "worker.model_result") {
    return "model_result";
  }
  if (entry.stage === "worker.write_effect") {
    return "write_effect";
  }
  return null;
}

function allowedCategoriesForPhase(phase: CaseKnowledgePhase): ReadonlySet<CaseEvidenceCategory> {
  if (phase === "decision_time") {
    return DECISION_TIME_ALLOWED_CATEGORIES;
  }
  if (phase === "outcome_time") {
    return OUTCOME_TIME_ALLOWED_CATEGORIES;
  }
  return REVIEW_TIME_ALLOWED_CATEGORIES;
}

function ensureTraceConsistency(
  entries: ReadonlyArray<JournalEntry>,
  traceId: string,
  phase: CaseKnowledgePhase
): void {
  for (const [index, entry] of entries.entries()) {
    if (entry.traceId !== traceId) {
      fail(`${phase}:trace_id_mismatch:${index}`);
    }
  }
}

function buildCaseJournalRecordRef(entry: JournalEntry, phase: CaseKnowledgePhase): CaseJournalRecordRef {
  const parsed = JournalEntrySchema.parse(entry);
  if (!parsed.eventHash) {
    fail(`${phase}:missing_event_hash`);
  }

  return CaseJournalRecordRefSchema.parse({
    trace_id: parsed.traceId,
    timestamp: parsed.timestamp,
    stage: parsed.stage,
    event_hash: parsed.eventHash,
    decision_hash: parsed.decisionHash,
    result_hash: parsed.resultHash,
    blocked: parsed.blocked,
    reason: parsed.reason,
  });
}

function buildCasePhase(
  phase: CaseKnowledgePhase,
  traceId: string,
  entries: ReadonlyArray<JournalEntry>
): {
  knowledge_phase: CaseKnowledgePhase;
  observed_at: string;
  source_journal_record_refs: CaseJournalRecordRef[];
  trace_refs: string[];
} {
  const normalizedEntries = canonicalizeJournalEntries(entries, phase);
  ensureTraceConsistency(normalizedEntries, traceId, phase);

  const allowedCategories = allowedCategoriesForPhase(phase);
  const sourceJournalRecordRefs = normalizedEntries.map((entry, index) => {
    const category = classifyJournalEntry(entry);
    if (!category) {
      fail(`${phase}:unsupported_stage:${index}:${entry.stage}`);
    }
    if (!allowedCategories.has(category)) {
      fail(`${phase}:disallowed_stage:${index}:${entry.stage}`);
    }
    return buildCaseJournalRecordRef(entry, phase);
  });

  return {
    knowledge_phase: phase,
    observed_at: normalizedEntries.at(-1)?.timestamp ?? fail(`${phase}:missing_observed_at`),
    source_journal_record_refs: sourceJournalRecordRefs,
    trace_refs: [...new Set(normalizedEntries.map((entry) => entry.traceId))].sort(compareText),
  };
}

function canonicalizeSubjectRefs(subjectRefs: ReadonlyArray<CaseSubjectRef>): CaseSubjectRef[] {
  if (subjectRefs.length === 0) {
    fail("subject_refs:missing_entries");
  }

  const normalized = subjectRefs.map((ref, index) => {
    const parsed = CaseSubjectRefSchema.safeParse(ref);
    if (!parsed.success) {
      fail(`subject_refs:invalid:${index}`);
    }
    return parsed.data;
  });

  normalized.sort((left, right) => compareText(left.subject_kind, right.subject_kind) || compareText(left.subject_id, right.subject_id));
  return normalized;
}

function ensureRequiredSubjectKinds(
  caseType: CanonicalCaseType,
  subjectRefs: ReadonlyArray<CaseSubjectRef>
): void {
  const requiredKinds = CASE_REQUIRED_SUBJECT_KINDS[caseType];
  for (const requiredKind of requiredKinds) {
    if (!subjectRefs.some((ref) => ref.subject_kind === requiredKind)) {
      fail(`subject_refs:missing_required_subject_kind:${caseType}:${requiredKind}`);
    }
  }
}

function buildEvidenceMap(input: {
  decision_time: ReturnType<typeof buildCasePhase>;
  outcome_time: ReturnType<typeof buildCasePhase>;
  review_time: ReturnType<typeof buildCasePhase>;
}): CanonicalCaseRecord["evidence"] {
  const allRefs = [
    ...input.decision_time.source_journal_record_refs,
    ...input.outcome_time.source_journal_record_refs,
    ...input.review_time.source_journal_record_refs,
  ];

  return {
    source_journal_record_refs: allRefs,
    event_refs: allRefs.filter((ref) => ref.stage === "worker.event"),
    gate_refs: allRefs.filter((ref) => ref.stage.startsWith("worker.gate.") || ref.stage === "worker.suppression"),
    routing_refs: allRefs.filter((ref) => ref.stage === "worker.routing"),
    transition_refs: allRefs.filter((ref) => ref.stage.startsWith("worker.transition.")),
    cadence_refs: allRefs.filter((ref) => ref.stage === "worker.cadence.policy"),
    write_effect_refs: allRefs.filter((ref) => ref.stage === "worker.write_effect"),
    trace_refs: [...new Set(allRefs.map((ref) => ref.trace_id))].sort(compareText),
    evidence_lineage_refs: allRefs
      .map((ref) => `${ref.trace_id}:${ref.stage}:${ref.event_hash}`)
      .sort(compareText),
  };
}

export function buildCanonicalCaseRecord(input: CanonicalCaseAssemblyInput): CanonicalCaseRecord {
  const case_type = input.case_type;
  const trace_id = input.trace_id;
  const subject_refs = canonicalizeSubjectRefs(input.subject_refs);

  ensureRequiredSubjectKinds(case_type, subject_refs);

  const decision_time = buildCasePhase("decision_time", trace_id, input.decision_time_journal_entries);
  const outcome_time = buildCasePhase("outcome_time", trace_id, input.outcome_time_journal_entries);
  const review_time = buildCasePhase("review_time", trace_id, input.review_time_journal_entries);

  if (compareText(decision_time.observed_at, outcome_time.observed_at) > 0) {
    fail("time_phase_order:decision_time_after_outcome_time");
  }
  if (compareText(outcome_time.observed_at, review_time.observed_at) > 0) {
    fail("time_phase_order:outcome_time_after_review_time");
  }

  const evidence = buildEvidenceMap({ decision_time, outcome_time, review_time });
  const recordWithoutCaseId = {
    schema_version: "casebook.canonical_case.v1" as const,
    layer: "canonical_case_record" as const,
    source_layer: "raw_journal_truth" as const,
    authority_class: "non_authoritative" as const,
    case_type,
    trace_id,
    subject_refs,
    decision_time,
    outcome_time,
    review_time,
    evidence,
    compressed_case_summary: input.compressed_case_summary,
    compressed_case_facts: [...(input.compressed_case_facts ?? [])],
    compressed_case_inferences: [...(input.compressed_case_inferences ?? [])],
    compressed_case_lessons: [...(input.compressed_case_lessons ?? [])],
    compression_version: input.compression_version,
  };
  const case_id = `casebook:${hashResult(recordWithoutCaseId)}`;
  const record: CanonicalCaseRecord = CanonicalCaseRecordSchema.parse({
    ...recordWithoutCaseId,
    case_id,
  });

  return record;
}

export function buildCanonicalCaseJournalRecord(caseRecord: CanonicalCaseRecord): CanonicalCaseJournalRecord {
  const parsed = CanonicalCaseRecordSchema.parse(caseRecord);
  return CanonicalCaseJournalRecordSchema.parse({
    recordType: "canonical_case",
    schemaVersion: CASEBOOK_CANONICAL_JOURNAL_SCHEMA_VERSION,
    caseRecord: parsed,
    replayKey: parsed.case_id,
  });
}

export function buildCanonicalCaseJournalEntry(caseRecord: CanonicalCaseRecord): JournalEntry {
  const record = buildCanonicalCaseJournalRecord(caseRecord);
  const input = {
    case_id: record.caseRecord.case_id,
    trace_id: record.caseRecord.trace_id,
    case_type: record.caseRecord.case_type,
    layer: record.caseRecord.layer,
    source_layer: record.caseRecord.source_layer,
    authority_class: record.caseRecord.authority_class,
    subject_refs: record.caseRecord.subject_refs,
    evidence: record.caseRecord.evidence,
    replayKey: record.replayKey,
  };
  const output = record;
  const decisionHash = hashDecision(input);
  const resultHash = hashResult(output);

  return {
    traceId: record.caseRecord.trace_id,
    timestamp: record.caseRecord.review_time.observed_at,
    stage: CASEBOOK_CANONICAL_JOURNAL_STAGE,
    decisionHash,
    resultHash,
    input,
    output,
    blocked: false,
    reason: "CASEBOOK_CANONICAL_CASE",
    eventHash: hashResult({
      traceId: record.caseRecord.trace_id,
      timestamp: record.caseRecord.review_time.observed_at,
      stage: CASEBOOK_CANONICAL_JOURNAL_STAGE,
      decisionHash,
      resultHash,
      blocked: false,
      reason: "CASEBOOK_CANONICAL_CASE",
    }),
  };
}

export async function appendCanonicalCaseJournal(
  writer: JournalWriter,
  caseRecord: CanonicalCaseRecord
): Promise<JournalEntry> {
  const entry = buildCanonicalCaseJournalEntry(caseRecord);
  await appendJournal(writer, entry);
  return entry;
}

function parseCanonicalCaseRecord(output: unknown): CanonicalCaseRecord | null {
  const parsed = CanonicalCaseJournalRecordSchema.safeParse(output);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.caseRecord;
}

export function reconstructCanonicalCaseReplay(entries: ReadonlyArray<JournalEntry>): CanonicalCaseReplayTrace {
  const replay: CanonicalCaseReplayTrace = {
    traceId: null,
    caseType: null,
    caseRecord: null,
    journalEntries: [...entries],
  };

  for (const entry of entries) {
    const caseRecord = parseCanonicalCaseRecord(entry.output);
    if (!caseRecord) {
      continue;
    }
    replay.traceId = caseRecord.trace_id;
    replay.caseType = caseRecord.case_type;
    replay.caseRecord = caseRecord;
  }

  return replay;
}
