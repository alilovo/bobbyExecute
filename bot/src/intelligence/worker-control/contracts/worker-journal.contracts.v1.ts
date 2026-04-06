import { z } from "zod";
import { NonAuthoritativeBoundarySchema } from "./boundary-utils.js";
import {
  AdvisoryModelOutputEnvelopeSchema,
  GateEvaluationRecordSchema,
  ModelRoutingResultSchema,
  SuppressionRecordSchema,
  WorkerControlEventEnvelopeSchema,
  WriteEffectEnvelopeSchema,
} from "./worker-control.contracts.v1.js";

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}:${issue.message}`;
    })
    .join(";");
}

export const WorkerJournalEventRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_event_record.v1"),
    record_kind: z.literal("event_record"),
    journal_event_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: WorkerControlEventEnvelopeSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalGateEvaluationRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_gate_evaluation_record.v1"),
    record_kind: z.literal("gate_evaluation_record"),
    journal_gate_eval_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: GateEvaluationRecordSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalModelRoutingRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_model_routing_record.v1"),
    record_kind: z.literal("model_routing_record"),
    journal_route_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: ModelRoutingResultSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalModelResultRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_model_result_record.v1"),
    record_kind: z.literal("model_result_record"),
    journal_model_result_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: AdvisoryModelOutputEnvelopeSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalSuppressionRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_suppression_record.v1"),
    record_kind: z.literal("suppression_record"),
    journal_suppression_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: SuppressionRecordSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalResultingWriteRecordSchema = z
  .object({
    schema_version: z.literal("worker_journal_resulting_write_record.v1"),
    record_kind: z.literal("resulting_write_record"),
    journal_write_effect_id: z.string().min(1),
    trace_id: z.string().min(1),
    event_id: z.string().min(1),
    payload: WriteEffectEnvelopeSchema,
    journaled_at: z.string().datetime(),
  })
  .merge(NonAuthoritativeBoundarySchema)
  .strict();

export const WorkerJournalRecordSchema = z.discriminatedUnion("record_kind", [
  WorkerJournalEventRecordSchema,
  WorkerJournalGateEvaluationRecordSchema,
  WorkerJournalModelRoutingRecordSchema,
  WorkerJournalModelResultRecordSchema,
  WorkerJournalSuppressionRecordSchema,
  WorkerJournalResultingWriteRecordSchema,
]);

export type WorkerJournalEventRecord = z.infer<typeof WorkerJournalEventRecordSchema>;
export type WorkerJournalGateEvaluationRecord = z.infer<typeof WorkerJournalGateEvaluationRecordSchema>;
export type WorkerJournalModelRoutingRecord = z.infer<typeof WorkerJournalModelRoutingRecordSchema>;
export type WorkerJournalModelResultRecord = z.infer<typeof WorkerJournalModelResultRecordSchema>;
export type WorkerJournalSuppressionRecord = z.infer<typeof WorkerJournalSuppressionRecordSchema>;
export type WorkerJournalResultingWriteRecord = z.infer<typeof WorkerJournalResultingWriteRecordSchema>;
export type WorkerJournalRecord = z.infer<typeof WorkerJournalRecordSchema>;

export function assertWorkerJournalRecord(value: unknown, source = "unknown"): WorkerJournalRecord {
  const result = WorkerJournalRecordSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new Error(`INVALID_WORKER_JOURNAL_RECORD:${source}:${formatZodIssues(result.error)}`);
}
