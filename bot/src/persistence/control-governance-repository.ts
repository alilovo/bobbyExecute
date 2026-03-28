import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type {
  ControlAuditEvent,
  ControlGovernanceRepository,
  ControlGovernanceRepositoryWithAudits,
  ControlLivePromotionRecord,
} from "../control/control-governance.js";
import { assertSchemaReady } from "./schema-migrations.js";

interface MemoryGovernanceState {
  audits: ControlAuditEvent[];
  promotions: ControlLivePromotionRecord[];
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

export class InMemoryControlGovernanceRepository implements ControlGovernanceRepositoryWithAudits {
  private readonly state: MemoryGovernanceState = {
    audits: [],
    promotions: [],
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
