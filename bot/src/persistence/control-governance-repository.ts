import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type {
  ControlAuditEvent,
  ControlGovernanceRepository,
  ControlGovernanceRepositoryWithAudits,
  ControlRecoveryRehearsalEvidenceRecord,
  ControlLivePromotionRecord,
} from "../control/control-governance.js";
import { assertSchemaReady } from "./schema-migrations.js";

interface MemoryGovernanceState {
  audits: ControlAuditEvent[];
  promotions: ControlLivePromotionRecord[];
  rehearsals: ControlRecoveryRehearsalEvidenceRecord[];
}

function clonePromotion(record: ControlLivePromotionRecord): ControlLivePromotionRecord {
  return JSON.parse(JSON.stringify(record)) as ControlLivePromotionRecord;
}

function cloneAudit(record: ControlAuditEvent): ControlAuditEvent {
  return JSON.parse(JSON.stringify(record)) as ControlAuditEvent;
}

function fromJson<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
}

function mapPromotionRow(row: Record<string, unknown>): ControlLivePromotionRecord {
  return fromJson<ControlLivePromotionRecord>(row.record_json);
}

function mapAuditRow(row: Record<string, unknown>): ControlAuditEvent {
  return fromJson<ControlAuditEvent>(row.event_json);
}

function mapRehearsalRow(row: Record<string, unknown>): ControlRecoveryRehearsalEvidenceRecord {
  return fromJson<ControlRecoveryRehearsalEvidenceRecord>(row.evidence_json);
}

export class InMemoryControlGovernanceRepository implements ControlGovernanceRepositoryWithAudits {
  private readonly state: MemoryGovernanceState = {
    audits: [],
    promotions: [],
    rehearsals: [],
  };

  async ensureSchema(): Promise<void> {
    return;
  }

  async recordAuditEvent(input: ControlAuditEvent): Promise<void> {
    this.state.audits.push({
      ...cloneAudit({
        ...input,
        id: input.id ?? randomUUID(),
        createdAt: input.createdAt ?? new Date().toISOString(),
      }),
    });
  }

  async recordDatabaseRehearsalEvidence(input: ControlRecoveryRehearsalEvidenceRecord): Promise<void> {
    this.state.rehearsals.push(JSON.parse(JSON.stringify(input)) as ControlRecoveryRehearsalEvidenceRecord);
  }

  async loadLatestDatabaseRehearsalEvidence(environment: string): Promise<ControlRecoveryRehearsalEvidenceRecord | null> {
    const record = [...this.state.rehearsals]
      .filter((entry) => entry.environment === environment)
      .sort((left, right) => Date.parse(right.executedAt) - Date.parse(left.executedAt))[0];
    return record ? (JSON.parse(JSON.stringify(record)) as ControlRecoveryRehearsalEvidenceRecord) : null;
  }

  async saveLivePromotionRequest(record: ControlLivePromotionRecord): Promise<void> {
    const next = clonePromotion(record);
    const index = this.state.promotions.findIndex((entry) => entry.id === next.id);
    if (index >= 0) {
      this.state.promotions[index] = next;
      return;
    }
    this.state.promotions.push(next);
  }

  async loadLivePromotionRequest(id: string): Promise<ControlLivePromotionRecord | null> {
    const record = this.state.promotions.find((entry) => entry.id === id);
    return record ? clonePromotion(record) : null;
  }

  async listLivePromotionRequests(environment: string, limit = 20): Promise<ControlLivePromotionRecord[]> {
    return this.state.promotions
      .filter((entry) => entry.environment === environment)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((record) => clonePromotion(record));
  }

  async listAuditEvents(environment: string, limit = 50): Promise<ControlAuditEvent[]> {
    return this.state.audits
      .filter((entry) => entry.environment === environment)
      .sort((left, right) => Date.parse(right.createdAt ?? new Date().toISOString()) - Date.parse(left.createdAt ?? new Date().toISOString()))
      .slice(0, limit)
      .map((record) => cloneAudit(record));
  }
}

export class PostgresControlGovernanceRepository implements ControlGovernanceRepositoryWithAudits {
  constructor(private readonly pool: Pool) {}

  private async withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await work(client);
    } finally {
      client.release();
    }
  }

  async ensureSchema(): Promise<void> {
    await assertSchemaReady(this.pool);
  }

  async recordAuditEvent(input: ControlAuditEvent): Promise<void> {
    const record = {
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO control_operator_audit_log (
            id, environment, action, target, result, actor_id, actor_display_name, actor_role,
            session_id, request_id, reason, note, created_at, event_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        [
          record.id,
          record.environment,
          record.action,
          record.target,
          record.result,
          record.actorId,
          record.actorDisplayName,
          record.actorRole,
          record.sessionId,
          record.requestId ?? null,
          record.reason ?? null,
          record.note ?? null,
          record.createdAt,
          JSON.stringify(record),
        ]
      );
    });
  }

  async recordDatabaseRehearsalEvidence(input: ControlRecoveryRehearsalEvidenceRecord): Promise<void> {
    const record = {
      ...input,
      recordedAt: input.recordedAt ?? new Date().toISOString(),
    };
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO control_database_rehearsal_evidence (
            id, environment, rehearsal_kind, status, executed_at, recorded_at, actor_id, actor_display_name,
            actor_role, session_id, source_context_json, target_context_json, source_database_fingerprint,
            target_database_fingerprint, source_schema_status_json, target_schema_status_before_json,
            target_schema_status_after_json, restore_validation_json, summary, failure_reason, evidence_json
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
          )
          ON CONFLICT (id) DO UPDATE SET
            environment = EXCLUDED.environment,
            rehearsal_kind = EXCLUDED.rehearsal_kind,
            status = EXCLUDED.status,
            executed_at = EXCLUDED.executed_at,
            recorded_at = EXCLUDED.recorded_at,
            actor_id = EXCLUDED.actor_id,
            actor_display_name = EXCLUDED.actor_display_name,
            actor_role = EXCLUDED.actor_role,
            session_id = EXCLUDED.session_id,
            source_context_json = EXCLUDED.source_context_json,
            target_context_json = EXCLUDED.target_context_json,
            source_database_fingerprint = EXCLUDED.source_database_fingerprint,
            target_database_fingerprint = EXCLUDED.target_database_fingerprint,
            source_schema_status_json = EXCLUDED.source_schema_status_json,
            target_schema_status_before_json = EXCLUDED.target_schema_status_before_json,
            target_schema_status_after_json = EXCLUDED.target_schema_status_after_json,
            restore_validation_json = EXCLUDED.restore_validation_json,
            summary = EXCLUDED.summary,
            failure_reason = EXCLUDED.failure_reason,
            evidence_json = EXCLUDED.evidence_json
        `,
        [
          record.id,
          record.environment,
          record.rehearsalKind,
          record.status,
          record.executedAt,
          record.recordedAt,
          record.actorId,
          record.actorDisplayName,
          record.actorRole,
          record.sessionId,
          JSON.stringify(record.sourceContext),
          JSON.stringify(record.targetContext),
          record.sourceDatabaseFingerprint,
          record.targetDatabaseFingerprint,
          JSON.stringify(record.sourceSchemaStatus),
          JSON.stringify(record.targetSchemaStatusBefore),
          record.targetSchemaStatusAfter ? JSON.stringify(record.targetSchemaStatusAfter) : null,
          JSON.stringify(record.restoreValidation),
          record.summary,
          record.failureReason ?? null,
          JSON.stringify(record),
        ]
      );
    });
  }

  async loadLatestDatabaseRehearsalEvidence(environment: string): Promise<ControlRecoveryRehearsalEvidenceRecord | null> {
    const result = await this.withClient((client) =>
      client.query(`SELECT evidence_json FROM control_database_rehearsal_evidence WHERE environment = $1 ORDER BY executed_at DESC LIMIT 1`, [environment])
    );
    const row = result.rows[0];
    return row ? mapRehearsalRow(row as Record<string, unknown>) : null;
  }

  async saveLivePromotionRequest(record: ControlLivePromotionRecord): Promise<void> {
    const next = {
      ...record,
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    };
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO control_live_promotions (
            id, environment, target_mode, workflow_status, application_status, requested_at, updated_at, record_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET
            environment = EXCLUDED.environment,
            target_mode = EXCLUDED.target_mode,
            workflow_status = EXCLUDED.workflow_status,
            application_status = EXCLUDED.application_status,
            requested_at = EXCLUDED.requested_at,
            updated_at = EXCLUDED.updated_at,
            record_json = EXCLUDED.record_json
        `,
        [
          next.id,
          next.environment,
          next.targetMode,
          next.workflowStatus,
          next.applicationStatus,
          next.requestedAt,
          next.updatedAt,
          JSON.stringify(next),
        ]
      );
    });
  }

  async loadLivePromotionRequest(id: string): Promise<ControlLivePromotionRecord | null> {
    const result = await this.withClient((client) =>
      client.query(`SELECT record_json FROM control_live_promotions WHERE id = $1 LIMIT 1`, [id])
    );
    const row = result.rows[0];
    return row ? mapPromotionRow(row as Record<string, unknown>) : null;
  }

  async listLivePromotionRequests(environment: string, limit = 20): Promise<ControlLivePromotionRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT record_json FROM control_live_promotions WHERE environment = $1 ORDER BY updated_at DESC LIMIT $2`,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapPromotionRow(row as Record<string, unknown>));
  }

  async listAuditEvents(environment: string, limit = 50): Promise<ControlAuditEvent[]> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT event_json FROM control_operator_audit_log WHERE environment = $1 ORDER BY created_at DESC LIMIT $2`,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapAuditRow(row as Record<string, unknown>));
  }
}

export async function createControlGovernanceRepository(databaseUrl?: string): Promise<ControlGovernanceRepositoryWithAudits> {
  if (!databaseUrl || databaseUrl.trim() === "") {
    return new InMemoryControlGovernanceRepository();
  }

  return new PostgresControlGovernanceRepository(new Pool({ connectionString: databaseUrl }));
}
