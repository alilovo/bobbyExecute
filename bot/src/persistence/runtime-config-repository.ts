import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  RuntimeBehaviorConfig,
  RuntimeOverlay,
  RuntimeConfigDocument,
} from "../config/runtime-config-schema.js";
import { runtimeConfigDocumentHash } from "../config/runtime-config-schema.js";
import { createPostgresPool } from "./postgres-pool.js";
import { assertSchemaReady } from "./schema-migrations.js";

export interface RuntimeConfigVersionRecord {
  id: string;
  environment: string;
  versionNumber: number;
  schemaVersion: number;
  config: RuntimeBehaviorConfig;
  configHash: string;
  previousVersionId?: string;
  status: "seeded" | "active" | "superseded" | "rejected";
  createdBy: string;
  reason?: string;
  createdAt: string;
  activatedAt?: string;
  activatedBy?: string;
  appliedAt?: string;
  appliedBy?: string;
}

export interface RuntimeConfigActiveRecord {
  environment: string;
  activeVersionId: string;
  requestedVersionId: string;
  appliedVersionId: string;
  lastValidVersionId: string;
  reloadNonce: number;
  paused: boolean;
  pauseScope?: "soft" | "hard";
  pauseReason?: string;
  killSwitch: boolean;
  killSwitchReason?: string;
  pendingApply: boolean;
  pendingReason?: string;
  requiresRestart: boolean;
  requestedAt: string;
  appliedAt?: string;
  updatedAt: string;
}

export interface RuntimeConfigChangeLogRecord {
  id: string;
  environment: string;
  versionId?: string;
  action: "seed" | "mode" | "pause" | "resume" | "kill_switch" | "runtime_config" | "reload" | "auth_failure";
  actor: string;
  accepted: boolean;
  beforeConfig?: RuntimeBehaviorConfig | null;
  afterConfig?: RuntimeBehaviorConfig | null;
  beforeOverlay?: RuntimeOverlay | null;
  afterOverlay?: RuntimeOverlay | null;
  reason?: string;
  rejectionReason?: string;
  resultVersionId?: string;
  reloadNonce: number;
  createdAt: string;
}

export interface RuntimeConfigBootstrapRecord {
  version: RuntimeConfigVersionRecord;
  active: RuntimeConfigActiveRecord;
}

export interface RuntimeConfigSeedInput {
  environment: string;
  behavior: RuntimeBehaviorConfig;
  actor: string;
  reason?: string;
}

export interface RuntimeConfigChangeInput {
  environment: string;
  actor: string;
  action: RuntimeConfigChangeLogRecord["action"];
  accepted: boolean;
  beforeConfig?: RuntimeBehaviorConfig | null;
  afterConfig?: RuntimeBehaviorConfig | null;
  beforeOverlay?: RuntimeOverlay | null;
  afterOverlay?: RuntimeOverlay | null;
  reason?: string;
  rejectionReason?: string;
  versionId?: string;
  resultVersionId?: string;
  reloadNonce: number;
  createdAt?: string;
}

export interface RuntimeConfigActiveUpdateInput {
  environment: string;
  activeVersionId: string;
  requestedVersionId: string;
  appliedVersionId: string;
  lastValidVersionId: string;
  reloadNonce: number;
  paused: boolean;
  pauseScope?: "soft" | "hard";
  pauseReason?: string;
  killSwitch: boolean;
  killSwitchReason?: string;
  pendingApply: boolean;
  pendingReason?: string;
  requiresRestart: boolean;
  requestedAt: string;
  appliedAt?: string;
  updatedAt?: string;
}

export interface RuntimeConfigRepository {
  kind: "postgres" | "memory";
  ensureSchema(): Promise<void>;
  loadActive(environment: string): Promise<RuntimeConfigActiveRecord | null>;
  loadVersion(environment: string, versionId: string): Promise<RuntimeConfigVersionRecord | null>;
  listVersions(environment: string, limit?: number): Promise<RuntimeConfigVersionRecord[]>;
  listChangeLog(environment: string, limit?: number): Promise<RuntimeConfigChangeLogRecord[]>;
  getLatestVersionNumber(environment: string): Promise<number>;
  seedEnvironment(input: RuntimeConfigSeedInput): Promise<RuntimeConfigBootstrapRecord>;
  createVersion(input: {
    environment: string;
    versionNumber: number;
    behavior: RuntimeBehaviorConfig;
    overlay?: RuntimeOverlay;
    actor: string;
    reason?: string;
    previousVersionId?: string;
    status?: RuntimeConfigVersionRecord["status"];
    activatedAt?: string;
    activatedBy?: string;
    appliedAt?: string;
    appliedBy?: string;
  }): Promise<RuntimeConfigVersionRecord>;
  updateActive(input: RuntimeConfigActiveUpdateInput): Promise<RuntimeConfigActiveRecord>;
  appendChangeLog(input: RuntimeConfigChangeInput): Promise<void>;
}

type MemoryEnvironmentState = {
  active: RuntimeConfigActiveRecord | null;
  versions: RuntimeConfigVersionRecord[];
  changeLog: RuntimeConfigChangeLogRecord[];
};

function cloneBehavior(behavior: RuntimeBehaviorConfig): RuntimeBehaviorConfig {
  return JSON.parse(JSON.stringify(behavior)) as RuntimeBehaviorConfig;
}

function cloneOverlay(overlay?: RuntimeOverlay | null): RuntimeOverlay | null {
  if (!overlay) {
    return null;
  }
  return JSON.parse(JSON.stringify(overlay)) as RuntimeOverlay;
}

function defaultOverlayState(reloadNonce = 0): RuntimeOverlay {
  return {
    paused: false,
    killSwitch: false,
    reloadNonce,
    pendingRestart: false,
  };
}

function buildDocumentHash(behavior: RuntimeBehaviorConfig, overlay?: RuntimeOverlay | null): string {
  const document: RuntimeConfigDocument = {
    schemaVersion: 1,
    behavior: cloneBehavior(behavior),
    overlay: cloneOverlay(overlay) ?? defaultOverlayState(),
  };
  return runtimeConfigDocumentHash(document);
}

function fromJson<T>(value: unknown, fallback: T): T {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function mapVersionRow(row: Record<string, unknown>): RuntimeConfigVersionRecord {
  return {
    id: String(row.id),
    environment: String(row.environment),
    versionNumber: Number(row.version_number),
    schemaVersion: Number(row.schema_version),
    config: fromJson<RuntimeBehaviorConfig>(row.config_json, row.config_json as RuntimeBehaviorConfig),
    configHash: String(row.config_hash),
    previousVersionId: row.previous_version_id == null ? undefined : String(row.previous_version_id),
    status: String(row.status) as RuntimeConfigVersionRecord["status"],
    createdBy: String(row.created_by),
    reason: row.reason == null ? undefined : String(row.reason),
    createdAt: String(row.created_at),
    activatedAt: row.activated_at == null ? undefined : String(row.activated_at),
    activatedBy: row.activated_by == null ? undefined : String(row.activated_by),
    appliedAt: row.applied_at == null ? undefined : String(row.applied_at),
    appliedBy: row.applied_by == null ? undefined : String(row.applied_by),
  };
}

function mapActiveRow(row: Record<string, unknown>): RuntimeConfigActiveRecord {
  return {
    environment: String(row.environment),
    activeVersionId: String(row.active_version_id),
    requestedVersionId: String(row.requested_version_id),
    appliedVersionId: String(row.applied_version_id),
    lastValidVersionId: String(row.last_valid_version_id),
    reloadNonce: Number(row.reload_nonce),
    paused: Boolean(row.paused),
    pauseScope: row.pause_scope == null ? undefined : (String(row.pause_scope) as RuntimeConfigActiveRecord["pauseScope"]),
    pauseReason: row.pause_reason == null ? undefined : String(row.pause_reason),
    killSwitch: Boolean(row.kill_switch),
    killSwitchReason: row.kill_switch_reason == null ? undefined : String(row.kill_switch_reason),
    pendingApply: Boolean(row.pending_apply),
    pendingReason: row.pending_reason == null ? undefined : String(row.pending_reason),
    requiresRestart: Boolean(row.requires_restart),
    requestedAt: String(row.requested_at),
    appliedAt: row.applied_at == null ? undefined : String(row.applied_at),
    updatedAt: String(row.updated_at),
  };
}

function mapChangeLogRow(row: Record<string, unknown>): RuntimeConfigChangeLogRecord {
  return {
    id: String(row.id),
    environment: String(row.environment),
    versionId: row.version_id == null ? undefined : String(row.version_id),
    action: String(row.action) as RuntimeConfigChangeLogRecord["action"],
    actor: String(row.actor),
    accepted: Boolean(row.accepted),
    beforeConfig: row.before_config == null ? null : (fromJson<RuntimeBehaviorConfig>(row.before_config, row.before_config as RuntimeBehaviorConfig) ?? null),
    afterConfig: row.after_config == null ? null : (fromJson<RuntimeBehaviorConfig>(row.after_config, row.after_config as RuntimeBehaviorConfig) ?? null),
    beforeOverlay: row.before_overlay == null ? null : (fromJson<RuntimeOverlay>(row.before_overlay, row.before_overlay as RuntimeOverlay) ?? null),
    afterOverlay: row.after_overlay == null ? null : (fromJson<RuntimeOverlay>(row.after_overlay, row.after_overlay as RuntimeOverlay) ?? null),
    reason: row.reason == null ? undefined : String(row.reason),
    rejectionReason: row.rejection_reason == null ? undefined : String(row.rejection_reason),
    resultVersionId: row.result_version_id == null ? undefined : String(row.result_version_id),
    reloadNonce: Number(row.reload_nonce),
    createdAt: String(row.created_at),
  };
}

export class InMemoryRuntimeConfigRepository implements RuntimeConfigRepository {
  kind = "memory" as const;

  private readonly states = new Map<string, MemoryEnvironmentState>();

  async ensureSchema(): Promise<void> {
    return;
  }

  private getState(environment: string): MemoryEnvironmentState {
    const existing = this.states.get(environment);
    if (existing) {
      return existing;
    }
    const created: MemoryEnvironmentState = { active: null, versions: [], changeLog: [] };
    this.states.set(environment, created);
    return created;
  }

  async loadActive(environment: string): Promise<RuntimeConfigActiveRecord | null> {
    const state = this.getState(environment);
    return state.active ? { ...state.active } : null;
  }

  async loadVersion(environment: string, versionId: string): Promise<RuntimeConfigVersionRecord | null> {
    const state = this.getState(environment);
    const version = state.versions.find((entry) => entry.id === versionId);
    return version ? { ...version, config: cloneBehavior(version.config) } : null;
  }

  async listVersions(environment: string, limit = 50): Promise<RuntimeConfigVersionRecord[]> {
    const state = this.getState(environment);
    return state.versions.slice(-limit).reverse().map((version) => ({
      ...version,
      config: cloneBehavior(version.config),
    }));
  }

  async listChangeLog(environment: string, limit = 50): Promise<RuntimeConfigChangeLogRecord[]> {
    const state = this.getState(environment);
    return state.changeLog.slice(-limit).reverse().map((entry) => ({
      ...entry,
      beforeConfig: entry.beforeConfig ? cloneBehavior(entry.beforeConfig) : null,
      afterConfig: entry.afterConfig ? cloneBehavior(entry.afterConfig) : null,
      beforeOverlay: cloneOverlay(entry.beforeOverlay),
      afterOverlay: cloneOverlay(entry.afterOverlay),
    }));
  }

  async getLatestVersionNumber(environment: string): Promise<number> {
    const state = this.getState(environment);
    return state.versions.reduce((max, entry) => Math.max(max, entry.versionNumber), 0);
  }

  async seedEnvironment(input: RuntimeConfigSeedInput): Promise<RuntimeConfigBootstrapRecord> {
    const state = this.getState(input.environment);
    if (state.active) {
      const version = state.versions.find((entry) => entry.id === state.active?.activeVersionId);
      if (!version) {
        throw new Error("runtime config repository is inconsistent");
      }
      return {
        version: { ...version, config: cloneBehavior(version.config) },
        active: { ...state.active },
      };
    }

    const versionId = randomUUID();
    const createdAt = new Date().toISOString();
    const version: RuntimeConfigVersionRecord = {
      id: versionId,
      environment: input.environment,
      versionNumber: 1,
      schemaVersion: input.behavior.schemaVersion,
      config: cloneBehavior(input.behavior),
      configHash: buildDocumentHash(input.behavior, defaultOverlayState(0)),
      previousVersionId: undefined,
      status: "seeded",
      createdBy: input.actor,
      reason: input.reason ?? "boot seed",
      createdAt,
      activatedAt: createdAt,
      activatedBy: input.actor,
      appliedAt: createdAt,
      appliedBy: input.actor,
    };
    const active: RuntimeConfigActiveRecord = {
      environment: input.environment,
      activeVersionId: versionId,
      requestedVersionId: versionId,
      appliedVersionId: versionId,
      lastValidVersionId: versionId,
      reloadNonce: 0,
      paused: false,
      killSwitch: false,
      pendingApply: false,
      requiresRestart: false,
      requestedAt: createdAt,
      appliedAt: createdAt,
      updatedAt: createdAt,
    };
    state.versions.push(version);
    state.active = { ...active };
    state.changeLog.push({
      id: randomUUID(),
      environment: input.environment,
      versionId,
      action: "seed",
      actor: input.actor,
      accepted: true,
      beforeConfig: null,
      afterConfig: cloneBehavior(input.behavior),
      beforeOverlay: null,
      afterOverlay: {
        paused: false,
        killSwitch: false,
        reloadNonce: 0,
        pendingRestart: false,
      },
      reason: input.reason ?? "boot seed",
      reloadNonce: 0,
      resultVersionId: versionId,
      createdAt,
    });
    return { version: { ...version, config: cloneBehavior(version.config) }, active: { ...active } };
  }

  async createVersion(input: {
    environment: string;
    versionNumber: number;
    behavior: RuntimeBehaviorConfig;
    overlay?: RuntimeOverlay;
    actor: string;
    reason?: string;
    previousVersionId?: string;
    status?: RuntimeConfigVersionRecord["status"];
    activatedAt?: string;
    activatedBy?: string;
    appliedAt?: string;
    appliedBy?: string;
  }): Promise<RuntimeConfigVersionRecord> {
    const state = this.getState(input.environment);
    const createdAt = new Date().toISOString();
    const version: RuntimeConfigVersionRecord = {
      id: randomUUID(),
      environment: input.environment,
      versionNumber: input.versionNumber,
      schemaVersion: input.behavior.schemaVersion,
      config: cloneBehavior(input.behavior),
      configHash: buildDocumentHash(
        input.behavior,
        input.overlay ?? {
          paused: state.active?.paused ?? false,
          killSwitch: state.active?.killSwitch ?? false,
          reloadNonce: state.active?.reloadNonce ?? 0,
          pendingRestart: state.active?.pendingApply ?? false,
        }
      ),
      previousVersionId: input.previousVersionId,
      status: input.status ?? "active",
      createdBy: input.actor,
      reason: input.reason,
      createdAt,
      activatedAt: input.activatedAt,
      activatedBy: input.activatedBy,
      appliedAt: input.appliedAt,
      appliedBy: input.appliedBy,
    };
    state.versions.push(version);
    return { ...version, config: cloneBehavior(version.config) };
  }

  async updateActive(input: RuntimeConfigActiveUpdateInput): Promise<RuntimeConfigActiveRecord> {
    const updatedAt = input.updatedAt ?? new Date().toISOString();
    const active: RuntimeConfigActiveRecord = {
      environment: input.environment,
      activeVersionId: input.activeVersionId,
      requestedVersionId: input.requestedVersionId,
      appliedVersionId: input.appliedVersionId,
      lastValidVersionId: input.lastValidVersionId,
      reloadNonce: input.reloadNonce,
      paused: input.paused,
      pauseScope: input.pauseScope,
      pauseReason: input.pauseReason,
      killSwitch: input.killSwitch,
      killSwitchReason: input.killSwitchReason,
      pendingApply: input.pendingApply,
      pendingReason: input.pendingReason,
      requiresRestart: input.requiresRestart,
      requestedAt: input.requestedAt,
      appliedAt: input.appliedAt,
      updatedAt,
    };
    this.getState(input.environment).active = { ...active };
    return { ...active };
  }

  async appendChangeLog(input: RuntimeConfigChangeInput): Promise<void> {
    this.getState(input.environment).changeLog.push({
      id: randomUUID(),
      environment: input.environment,
      versionId: input.versionId,
      action: input.action,
      actor: input.actor,
      accepted: input.accepted,
      beforeConfig: input.beforeConfig ? cloneBehavior(input.beforeConfig) : null,
      afterConfig: input.afterConfig ? cloneBehavior(input.afterConfig) : null,
      beforeOverlay: cloneOverlay(input.beforeOverlay),
      afterOverlay: cloneOverlay(input.afterOverlay),
      reason: input.reason,
      rejectionReason: input.rejectionReason,
      resultVersionId: input.resultVersionId,
      reloadNonce: input.reloadNonce,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }
}

function cloneVersionRecord(record: RuntimeConfigVersionRecord): RuntimeConfigVersionRecord {
  return {
    ...record,
    config: cloneBehavior(record.config),
  };
}

function cloneActiveRecord(record: RuntimeConfigActiveRecord): RuntimeConfigActiveRecord {
  return { ...record };
}

function cloneChangeLogRecord(record: RuntimeConfigChangeLogRecord): RuntimeConfigChangeLogRecord {
  return {
    ...record,
    beforeConfig: record.beforeConfig ? cloneBehavior(record.beforeConfig) : null,
    afterConfig: record.afterConfig ? cloneBehavior(record.afterConfig) : null,
    beforeOverlay: cloneOverlay(record.beforeOverlay),
    afterOverlay: cloneOverlay(record.afterOverlay),
  };
}

export class PostgresRuntimeConfigRepository implements RuntimeConfigRepository {
  kind = "postgres" as const;

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

  async loadActive(environment: string): Promise<RuntimeConfigActiveRecord | null> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT * FROM runtime_config_active WHERE environment = $1 LIMIT 1`,
        [environment]
      )
    );
    const row = result.rows[0];
    return row ? mapActiveRow(row as Record<string, unknown>) : null;
  }

  async loadVersion(environment: string, versionId: string): Promise<RuntimeConfigVersionRecord | null> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT * FROM runtime_config_versions WHERE environment = $1 AND id = $2 LIMIT 1`,
        [environment, versionId]
      )
    );
    const row = result.rows[0];
    return row ? mapVersionRow(row as Record<string, unknown>) : null;
  }

  async listVersions(environment: string, limit = 50): Promise<RuntimeConfigVersionRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT * FROM runtime_config_versions WHERE environment = $1 ORDER BY version_number DESC, created_at DESC LIMIT $2`,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapVersionRow(row as Record<string, unknown>));
  }

  async listChangeLog(environment: string, limit = 50): Promise<RuntimeConfigChangeLogRecord[]> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT * FROM config_change_log WHERE environment = $1 ORDER BY created_at DESC LIMIT $2`,
        [environment, limit]
      )
    );
    return result.rows.map((row) => mapChangeLogRow(row as Record<string, unknown>));
  }

  async getLatestVersionNumber(environment: string): Promise<number> {
    const result = await this.withClient((client) =>
      client.query(
        `SELECT COALESCE(MAX(version_number), 0) AS version_number FROM runtime_config_versions WHERE environment = $1`,
        [environment]
      )
    );
    return Number(result.rows[0]?.version_number ?? 0);
  }

  async seedEnvironment(input: RuntimeConfigSeedInput): Promise<RuntimeConfigBootstrapRecord> {
    return this.withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [input.environment]);
        const activeResult = await client.query(
          `SELECT * FROM runtime_config_active WHERE environment = $1 LIMIT 1`,
          [input.environment]
        );
        if (activeResult.rows.length > 0) {
          const active = mapActiveRow(activeResult.rows[0] as Record<string, unknown>);
          const versionResult = await client.query(
            `SELECT * FROM runtime_config_versions WHERE environment = $1 AND id = $2 LIMIT 1`,
            [input.environment, active.activeVersionId]
          );
          const versionRow = versionResult.rows[0];
          if (!versionRow) {
            throw new Error(`runtime config repository is inconsistent for environment '${input.environment}'`);
          }
          const version = mapVersionRow(versionRow as Record<string, unknown>);
          await client.query("COMMIT");
          return { version, active };
        }

        const latestResult = await client.query(
          `SELECT COALESCE(MAX(version_number), 0) AS version_number FROM runtime_config_versions WHERE environment = $1`,
          [input.environment]
        );
        const versionNumber = Number(latestResult.rows[0]?.version_number ?? 0) + 1;
        const versionId = randomUUID();
        const createdAt = new Date().toISOString();
        const overlay = defaultOverlayState(0);
        const version: RuntimeConfigVersionRecord = {
          id: versionId,
          environment: input.environment,
          versionNumber,
          schemaVersion: input.behavior.schemaVersion,
          config: cloneBehavior(input.behavior),
          configHash: buildDocumentHash(input.behavior, overlay),
          previousVersionId: undefined,
          status: "seeded",
          createdBy: input.actor,
          reason: input.reason ?? "boot seed",
          createdAt,
          activatedAt: createdAt,
          activatedBy: input.actor,
          appliedAt: createdAt,
          appliedBy: input.actor,
        };
        const active: RuntimeConfigActiveRecord = {
          environment: input.environment,
          activeVersionId: versionId,
          requestedVersionId: versionId,
          appliedVersionId: versionId,
          lastValidVersionId: versionId,
          reloadNonce: 0,
          paused: false,
          killSwitch: false,
          pendingApply: false,
          requiresRestart: false,
          requestedAt: createdAt,
          appliedAt: createdAt,
          updatedAt: createdAt,
        };

        await client.query(
          `
            INSERT INTO runtime_config_versions (
              id, environment, version_number, schema_version, config_json, config_hash,
              previous_version_id, status, created_by, reason, created_at, activated_at, activated_by, applied_at, applied_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `,
          [
            version.id,
            version.environment,
            version.versionNumber,
            version.schemaVersion,
            JSON.stringify(version.config),
            version.configHash,
            version.previousVersionId,
            version.status,
            version.createdBy,
            version.reason ?? null,
            version.createdAt,
            version.activatedAt ?? null,
            version.activatedBy ?? null,
            version.appliedAt ?? null,
            version.appliedBy ?? null,
          ]
        );

        await client.query(
          `
            INSERT INTO runtime_config_active (
              environment, active_version_id, requested_version_id, applied_version_id, last_valid_version_id,
              reload_nonce, paused, pause_scope, pause_reason, kill_switch, kill_switch_reason,
              pending_apply, pending_reason, requires_restart, requested_at, applied_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          `,
          [
            active.environment,
            active.activeVersionId,
            active.requestedVersionId,
            active.appliedVersionId,
            active.lastValidVersionId,
            active.reloadNonce,
            active.paused,
            active.pauseScope ?? null,
            active.pauseReason ?? null,
            active.killSwitch,
            active.killSwitchReason ?? null,
            active.pendingApply,
            active.pendingReason ?? null,
            active.requiresRestart,
            active.requestedAt,
            active.appliedAt ?? null,
            active.updatedAt,
          ]
        );

        await client.query(
          `
            INSERT INTO config_change_log (
              id, environment, version_id, action, actor, accepted, before_config, after_config,
              before_overlay, after_overlay, reason, rejection_reason, result_version_id, reload_nonce, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `,
          [
            randomUUID(),
            input.environment,
            version.id,
            "seed",
            input.actor,
            true,
            null,
            JSON.stringify(version.config),
            null,
            JSON.stringify(overlay),
            input.reason ?? "boot seed",
            null,
            version.id,
            0,
            createdAt,
          ]
        );

        await client.query("COMMIT");
        return { version, active };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  async createVersion(input: {
    environment: string;
    versionNumber: number;
    behavior: RuntimeBehaviorConfig;
    overlay?: RuntimeOverlay;
    actor: string;
    reason?: string;
    previousVersionId?: string;
    status?: RuntimeConfigVersionRecord["status"];
    activatedAt?: string;
    activatedBy?: string;
    appliedAt?: string;
    appliedBy?: string;
  }): Promise<RuntimeConfigVersionRecord> {
    const createdAt = new Date().toISOString();
    const configHash = buildDocumentHash(input.behavior, input.overlay);
    const record: RuntimeConfigVersionRecord = {
      id: randomUUID(),
      environment: input.environment,
      versionNumber: input.versionNumber,
      schemaVersion: input.behavior.schemaVersion,
      config: cloneBehavior(input.behavior),
      configHash,
      previousVersionId: input.previousVersionId,
      status: input.status ?? "active",
      createdBy: input.actor,
      reason: input.reason,
      createdAt,
      activatedAt: input.activatedAt,
      activatedBy: input.activatedBy,
      appliedAt: input.appliedAt,
      appliedBy: input.appliedBy,
    };

    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO runtime_config_versions (
            id, environment, version_number, schema_version, config_json, config_hash,
            previous_version_id, status, created_by, reason, created_at, activated_at, activated_by, applied_at, applied_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          record.id,
          record.environment,
          record.versionNumber,
          record.schemaVersion,
          JSON.stringify(record.config),
          record.configHash,
          record.previousVersionId,
          record.status,
          record.createdBy,
          record.reason ?? null,
          record.createdAt,
          record.activatedAt ?? null,
          record.activatedBy ?? null,
          record.appliedAt ?? null,
          record.appliedBy ?? null,
        ]
      );
    });

    return cloneVersionRecord(record);
  }

  async updateActive(input: RuntimeConfigActiveUpdateInput): Promise<RuntimeConfigActiveRecord> {
    const updatedAt = input.updatedAt ?? new Date().toISOString();
    const record: RuntimeConfigActiveRecord = {
      environment: input.environment,
      activeVersionId: input.activeVersionId,
      requestedVersionId: input.requestedVersionId,
      appliedVersionId: input.appliedVersionId,
      lastValidVersionId: input.lastValidVersionId,
      reloadNonce: input.reloadNonce,
      paused: input.paused,
      pauseScope: input.pauseScope,
      pauseReason: input.pauseReason,
      killSwitch: input.killSwitch,
      killSwitchReason: input.killSwitchReason,
      pendingApply: input.pendingApply,
      pendingReason: input.pendingReason,
      requiresRestart: input.requiresRestart,
      requestedAt: input.requestedAt,
      appliedAt: input.appliedAt,
      updatedAt,
    };

    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO runtime_config_active (
            environment, active_version_id, requested_version_id, applied_version_id, last_valid_version_id,
            reload_nonce, paused, pause_scope, pause_reason, kill_switch, kill_switch_reason,
            pending_apply, pending_reason, requires_restart, requested_at, applied_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (environment) DO UPDATE SET
            active_version_id = EXCLUDED.active_version_id,
            requested_version_id = EXCLUDED.requested_version_id,
            applied_version_id = EXCLUDED.applied_version_id,
            last_valid_version_id = EXCLUDED.last_valid_version_id,
            reload_nonce = EXCLUDED.reload_nonce,
            paused = EXCLUDED.paused,
            pause_scope = EXCLUDED.pause_scope,
            pause_reason = EXCLUDED.pause_reason,
            kill_switch = EXCLUDED.kill_switch,
            kill_switch_reason = EXCLUDED.kill_switch_reason,
            pending_apply = EXCLUDED.pending_apply,
            pending_reason = EXCLUDED.pending_reason,
            requires_restart = EXCLUDED.requires_restart,
            requested_at = EXCLUDED.requested_at,
            applied_at = EXCLUDED.applied_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          record.environment,
          record.activeVersionId,
          record.requestedVersionId,
          record.appliedVersionId,
          record.lastValidVersionId,
          record.reloadNonce,
          record.paused,
          record.pauseScope ?? null,
          record.pauseReason ?? null,
          record.killSwitch,
          record.killSwitchReason ?? null,
          record.pendingApply,
          record.pendingReason ?? null,
          record.requiresRestart,
          record.requestedAt,
          record.appliedAt ?? null,
          record.updatedAt,
        ]
      );
    });

    return cloneActiveRecord(record);
  }

  async appendChangeLog(input: RuntimeConfigChangeInput): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO config_change_log (
            id, environment, version_id, action, actor, accepted, before_config, after_config,
            before_overlay, after_overlay, reason, rejection_reason, result_version_id, reload_nonce, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          randomUUID(),
          input.environment,
          input.versionId ?? null,
          input.action,
          input.actor,
          input.accepted,
          input.beforeConfig ? JSON.stringify(input.beforeConfig) : null,
          input.afterConfig ? JSON.stringify(input.afterConfig) : null,
          input.beforeOverlay ? JSON.stringify(input.beforeOverlay) : null,
          input.afterOverlay ? JSON.stringify(input.afterOverlay) : null,
          input.reason ?? null,
          input.rejectionReason ?? null,
          input.resultVersionId ?? null,
          input.reloadNonce,
          input.createdAt ?? new Date().toISOString(),
        ]
      );
    });
  }
}

export async function createRuntimeConfigRepository(databaseUrl?: string): Promise<RuntimeConfigRepository> {
  if (!databaseUrl || databaseUrl.trim() === "") {
    return new InMemoryRuntimeConfigRepository();
  }

  return new PostgresRuntimeConfigRepository(createPostgresPool(databaseUrl));
}
