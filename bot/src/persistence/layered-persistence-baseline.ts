import { z } from "zod";
import { JournalEntrySchema, type JournalEntry } from "../core/contracts/journal.js";
import {
  CaseJournalRecordRefSchema,
  CaseSubjectKinds,
  CanonicalCaseRecordSchema,
  type CanonicalCaseRecord,
} from "../core/contracts/casebook.js";
import {
  DerivedKnowledgeViewSchema,
  type DerivedKnowledgeView,
} from "../core/contracts/derived-views.js";
import {
  MachineSafePriorRecordSchema,
  type MachineSafePriorRecord,
} from "../core/contracts/priors.js";
import { PlaybookSchema, type PlaybookRevision } from "../core/contracts/playbooks.js";

export const PERSISTENCE_LAYER_NAMES = [
  "registry",
  "journal",
  "casebook",
  "knowledge",
  "playbook",
  "ops",
] as const;
export type PersistenceLayerName = (typeof PERSISTENCE_LAYER_NAMES)[number];
export const PersistenceLayerSchema = z.enum(PERSISTENCE_LAYER_NAMES);

export const PERSISTENCE_LAYER_MANIFEST = {
  registry: {
    record_family: "registry_entity_revision",
    storage_role: "support_only",
    append_policy: "append_reject_duplicate",
  },
  journal: {
    record_family: "journal_entry",
    storage_role: "raw_truth",
    append_policy: "append_only",
  },
  casebook: {
    record_family: "canonical_case_record",
    storage_role: "non_primary_projection",
    append_policy: "append_reject_duplicate",
  },
  knowledge: {
    record_family: "derived_knowledge_view|machine_safe_prior",
    storage_role: "non_primary_projection",
    append_policy: "append_reject_duplicate",
  },
  playbook: {
    record_family: "playbook_revision",
    storage_role: "non_primary_projection",
    append_policy: "append_reject_duplicate",
  },
  ops: {
    record_family: "ops_artifact",
    storage_role: "support_only",
    append_policy: "append_reject_duplicate",
  },
} as const;

export const REGISTRY_ENTITY_KINDS = [
  ...CaseSubjectKinds,
  "journal_record",
  "case_record",
  "knowledge_view",
  "machine_safe_prior",
  "playbook",
  "ops_artifact",
] as const;
export const RegistryEntityKindSchema = z.enum(REGISTRY_ENTITY_KINDS);

export const RegistryEntityRevisionSchema = z
  .object({
    schema_version: z.literal("persistence.registry_entity_revision.v1"),
    layer: z.literal("registry"),
    authority_class: z.literal("non_authoritative"),
    entity_revision_id: z.string().min(1),
    prior_entity_revision_id: z.string().min(1).nullable(),
    entity_kind: RegistryEntityKindSchema,
    entity_id: z.string().min(1),
    entity_label: z.string().min(1).optional(),
    aliases: z.array(z.string().min(1)).default([]),
    source_journal_record_refs: z.array(CaseJournalRecordRefSchema).min(1),
    audit_log_entry_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
    mirror_role: z.literal("non_primary"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.prior_entity_revision_id != null && value.prior_entity_revision_id === value.entity_revision_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prior_entity_revision_id"],
        message: "prior_entity_revision_id_must_not_match_entity_revision_id",
      });
    }
  });
export type RegistryEntityRevision = z.infer<typeof RegistryEntityRevisionSchema>;

export const RegistryPersistenceRecordSchema = RegistryEntityRevisionSchema;
export type RegistryPersistenceRecord = RegistryEntityRevision;

export const JournalPersistenceRecordSchema = JournalEntrySchema.strict();
export type JournalPersistenceRecord = JournalEntry;

export const CasebookPersistenceRecordSchema = CanonicalCaseRecordSchema;
export type CasebookPersistenceRecord = CanonicalCaseRecord;

export const KnowledgePersistenceRecordSchema = z.union([
  DerivedKnowledgeViewSchema,
  MachineSafePriorRecordSchema,
]);
export type KnowledgePersistenceRecord = DerivedKnowledgeView | MachineSafePriorRecord;

export const PlaybookPersistenceRecordSchema = PlaybookSchema;
export type PlaybookPersistenceRecord = PlaybookRevision;

export const OPS_ARTIFACT_KINDS = [
  "audit_log_projection",
  "review_queue_projection",
  "materialization_state",
  "schema_snapshot",
] as const;
export const OpsArtifactKindSchema = z.enum(OPS_ARTIFACT_KINDS);

export const OPS_ARTIFACT_STATUSES = [
  "proposed",
  "queued",
  "running",
  "complete",
  "failed",
  "archived",
] as const;
export const OpsArtifactStatusSchema = z.enum(OPS_ARTIFACT_STATUSES);

export const OpsArtifactRecordSchema = z
  .object({
    schema_version: z.literal("persistence.ops_artifact.v1"),
    layer: z.literal("ops"),
    authority_class: z.literal("non_authoritative"),
    record_id: z.string().min(1),
    artifact_kind: OpsArtifactKindSchema,
    artifact_ref: z.string().min(1),
    status: OpsArtifactStatusSchema,
    source_record_refs: z.array(z.string().min(1)).default([]),
    audit_log_entry_refs: z.array(z.string().min(1)).min(1),
    evidence_lineage_refs: z.array(z.string().min(1)).min(1),
    mirror_role: z.literal("non_primary"),
  })
  .strict();
export type OpsArtifactRecord = z.infer<typeof OpsArtifactRecordSchema>;

export const PERSISTENCE_LAYER_RECORD_SCHEMAS = {
  registry: RegistryPersistenceRecordSchema,
  journal: JournalPersistenceRecordSchema,
  casebook: CasebookPersistenceRecordSchema,
  knowledge: KnowledgePersistenceRecordSchema,
  playbook: PlaybookPersistenceRecordSchema,
  ops: OpsArtifactRecordSchema,
} as const;

export interface LayeredPersistenceRecordMap {
  registry: RegistryPersistenceRecord;
  journal: JournalPersistenceRecord;
  casebook: CasebookPersistenceRecord;
  knowledge: KnowledgePersistenceRecord;
  playbook: PlaybookPersistenceRecord;
  ops: OpsArtifactRecord;
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface LayeredPersistenceStore {
  append(layer: "registry", record: RegistryPersistenceRecord): Promise<RegistryPersistenceRecord>;
  append(layer: "journal", record: JournalPersistenceRecord): Promise<JournalPersistenceRecord>;
  append(layer: "casebook", record: CasebookPersistenceRecord): Promise<CasebookPersistenceRecord>;
  append(layer: "knowledge", record: KnowledgePersistenceRecord): Promise<KnowledgePersistenceRecord>;
  append(layer: "playbook", record: PlaybookPersistenceRecord): Promise<PlaybookPersistenceRecord>;
  append(layer: "ops", record: OpsArtifactRecord): Promise<OpsArtifactRecord>;

  list(layer: "registry"): Promise<RegistryPersistenceRecord[]>;
  list(layer: "journal"): Promise<JournalPersistenceRecord[]>;
  list(layer: "casebook"): Promise<CasebookPersistenceRecord[]>;
  list(layer: "knowledge"): Promise<KnowledgePersistenceRecord[]>;
  list(layer: "playbook"): Promise<PlaybookPersistenceRecord[]>;
  list(layer: "ops"): Promise<OpsArtifactRecord[]>;

  clear(layer?: PersistenceLayerName): Promise<void>;
}

export class InMemoryLayeredPersistenceStore implements LayeredPersistenceStore {
  private readonly records: { [K in PersistenceLayerName]: LayeredPersistenceRecordMap[K][] } = {
    registry: [],
    journal: [],
    casebook: [],
    knowledge: [],
    playbook: [],
    ops: [],
  };

  private readonly keys: {
    registry: Set<string>;
    casebook: Set<string>;
    knowledge: Set<string>;
    playbook: Set<string>;
    ops: Set<string>;
  } = {
    registry: new Set<string>(),
    casebook: new Set<string>(),
    knowledge: new Set<string>(),
    playbook: new Set<string>(),
    ops: new Set<string>(),
  };

  async append(layer: "registry", record: RegistryPersistenceRecord): Promise<RegistryPersistenceRecord>;
  async append(layer: "journal", record: JournalPersistenceRecord): Promise<JournalPersistenceRecord>;
  async append(layer: "casebook", record: CasebookPersistenceRecord): Promise<CasebookPersistenceRecord>;
  async append(layer: "knowledge", record: KnowledgePersistenceRecord): Promise<KnowledgePersistenceRecord>;
  async append(layer: "playbook", record: PlaybookPersistenceRecord): Promise<PlaybookPersistenceRecord>;
  async append(layer: "ops", record: OpsArtifactRecord): Promise<OpsArtifactRecord>;
  async append(
    layer: PersistenceLayerName,
    record: LayeredPersistenceRecordMap[PersistenceLayerName]
  ): Promise<LayeredPersistenceRecordMap[PersistenceLayerName]> {
    switch (layer) {
      case "registry": {
        const parsed = RegistryPersistenceRecordSchema.parse(record as RegistryPersistenceRecord);
        const snapshot = cloneRecord(parsed);
        const priorVersionId = snapshot.prior_entity_revision_id;
        if (priorVersionId != null && !this.keys.registry.has(priorVersionId)) {
          throw new Error(`PERSISTENCE_LAYER_MISSING_PRIOR:registry:${priorVersionId}`);
        }

        const key = snapshot.entity_revision_id;
        if (this.keys.registry.has(key)) {
          throw new Error(`PERSISTENCE_LAYER_DUPLICATE:registry:${key}`);
        }
        this.keys.registry.add(key);
        this.records.registry.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      case "journal": {
        const snapshot = cloneRecord(JournalPersistenceRecordSchema.parse(record as JournalPersistenceRecord));
        this.records.journal.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      case "casebook": {
        const snapshot = cloneRecord(CasebookPersistenceRecordSchema.parse(record as CasebookPersistenceRecord));
        const key = snapshot.case_id;
        if (this.keys.casebook.has(key)) {
          throw new Error(`PERSISTENCE_LAYER_DUPLICATE:casebook:${key}`);
        }
        this.keys.casebook.add(key);
        this.records.casebook.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      case "knowledge": {
        const snapshot = cloneRecord(KnowledgePersistenceRecordSchema.parse(record as KnowledgePersistenceRecord));
        const key = "view_id" in snapshot ? `view:${snapshot.view_id}` : `prior:${snapshot.prior_id}`;
        if (this.keys.knowledge.has(key)) {
          throw new Error(`PERSISTENCE_LAYER_DUPLICATE:knowledge:${key}`);
        }
        this.keys.knowledge.add(key);
        this.records.knowledge.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      case "playbook": {
        const parsed = PlaybookPersistenceRecordSchema.parse(record as PlaybookPersistenceRecord);
        const snapshot = cloneRecord(parsed);
        const priorVersionId = snapshot.version_trace.prior_version_id;
        if (priorVersionId != null && !this.keys.playbook.has(priorVersionId)) {
          throw new Error(`PERSISTENCE_LAYER_MISSING_PRIOR:playbook:${priorVersionId}`);
        }

        const key = snapshot.version_trace.version_id;
        if (this.keys.playbook.has(key)) {
          throw new Error(`PERSISTENCE_LAYER_DUPLICATE:playbook:${key}`);
        }
        this.keys.playbook.add(key);
        this.records.playbook.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      case "ops": {
        const snapshot = cloneRecord(OpsArtifactRecordSchema.parse(record as OpsArtifactRecord));
        const key = snapshot.record_id;
        if (this.keys.ops.has(key)) {
          throw new Error(`PERSISTENCE_LAYER_DUPLICATE:ops:${key}`);
        }
        this.keys.ops.add(key);
        this.records.ops.push(cloneRecord(snapshot));
        return cloneRecord(snapshot);
      }
      default: {
        const exhaustiveCheck: never = layer;
        return exhaustiveCheck;
      }
    }
  }

  async list(layer: "registry"): Promise<RegistryPersistenceRecord[]>;
  async list(layer: "journal"): Promise<JournalPersistenceRecord[]>;
  async list(layer: "casebook"): Promise<CasebookPersistenceRecord[]>;
  async list(layer: "knowledge"): Promise<KnowledgePersistenceRecord[]>;
  async list(layer: "playbook"): Promise<PlaybookPersistenceRecord[]>;
  async list(layer: "ops"): Promise<OpsArtifactRecord[]>;
  async list(layer: PersistenceLayerName): Promise<LayeredPersistenceRecordMap[PersistenceLayerName][]> {
    return this.records[layer].map((record) => cloneRecord(record));
  }

  async clear(layer?: PersistenceLayerName): Promise<void> {
    if (layer) {
      switch (layer) {
        case "registry":
          this.records.registry = [];
          this.keys.registry.clear();
          break;
        case "journal":
          this.records.journal = [];
          break;
        case "casebook":
          this.records.casebook = [];
          this.keys.casebook.clear();
          break;
        case "knowledge":
          this.records.knowledge = [];
          this.keys.knowledge.clear();
          break;
        case "playbook":
          this.records.playbook = [];
          this.keys.playbook.clear();
          break;
        case "ops":
          this.records.ops = [];
          this.keys.ops.clear();
          break;
        default: {
          const exhaustiveCheck: never = layer;
          return exhaustiveCheck;
        }
      }
      return;
    }

    this.records.registry = [];
    this.records.journal = [];
    this.records.casebook = [];
    this.records.knowledge = [];
    this.records.playbook = [];
    this.records.ops = [];
    this.keys.registry.clear();
    this.keys.casebook.clear();
    this.keys.knowledge.clear();
    this.keys.playbook.clear();
    this.keys.ops.clear();
  }
}
