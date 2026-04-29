import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type SchemaMigrationState =
  | "ready"
  | "missing_but_migratable"
  | "migration_required"
  | "unrecoverable";

export interface SchemaMigrationFile {
  version: string;
  name: string;
  checksum: string;
}

interface SchemaMigrationFileWithSql extends SchemaMigrationFile {
  filePath: string;
  sql: string;
}

export interface AppliedSchemaMigration {
  version: string;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface SchemaMigrationChecksumMismatch {
  version: string;
  name: string;
  expectedChecksum: string;
  appliedChecksum: string;
}

export interface SchemaMigrationStatus {
  state: SchemaMigrationState;
  ready: boolean;
  migrationTablePresent: boolean;
  message: string;
  migrationsDir: string;
  availableMigrations: SchemaMigrationFile[];
  appliedMigrations: AppliedSchemaMigration[];
  pendingMigrations: SchemaMigrationFile[];
  checksumMismatches: SchemaMigrationChecksumMismatch[];
  unknownAppliedVersions: AppliedSchemaMigration[];
}

export interface SchemaMigrationRow {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
}

export interface SchemaMigrationClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[]
  ): Promise<{ rows: T[] }>;
  release(): void;
}

export interface SchemaMigrationConnection {
  connect(): Promise<SchemaMigrationClient>;
}

export interface SchemaMigrationOptions {
  migrationsDir?: string;
}

export class SchemaMigrationError extends Error {
  constructor(public readonly status: SchemaMigrationStatus) {
    super(status.message);
    this.name = "SchemaMigrationError";
  }
}

export const DEFAULT_MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? join(process.cwd(), "migrations");
function checksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function loadMigrationFiles(migrationsDir: string): Promise<SchemaMigrationFileWithSql[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const migrations: SchemaMigrationFileWithSql[] = [];
  for (const fileName of files) {
    const filePath = join(migrationsDir, fileName);
    const sql = await readFile(filePath, "utf8");
    migrations.push({
      version: fileName,
      name: fileName.replace(/\.sql$/i, ""),
      checksum: checksum(sql),
      filePath,
      sql,
    });
  }

  return migrations;
}

function buildStatus(
  migrationsDir: string,
  available: SchemaMigrationFileWithSql[],
  appliedRows: SchemaMigrationRow[],
  migrationTablePresent: boolean
): SchemaMigrationStatus {
  const appliedByVersion = new Map<string, AppliedSchemaMigration>();
  const checksumMismatches: SchemaMigrationChecksumMismatch[] = [];
  const unknownAppliedVersions: AppliedSchemaMigration[] = [];

  for (const row of appliedRows) {
    const applied: AppliedSchemaMigration = {
      version: row.version,
      name: row.name,
      checksum: row.checksum,
      appliedAt: row.applied_at,
    };
    const existing = appliedByVersion.get(row.version);
    if (existing) {
      unknownAppliedVersions.push(applied);
      continue;
    }
    appliedByVersion.set(row.version, applied);
  }

  for (const applied of appliedByVersion.values()) {
    const expected = available.find((migration) => migration.version === applied.version);
    if (!expected) {
      unknownAppliedVersions.push(applied);
      continue;
    }

    if (expected.checksum !== applied.checksum) {
      checksumMismatches.push({
        version: applied.version,
        name: expected.name,
        expectedChecksum: expected.checksum,
        appliedChecksum: applied.checksum,
      });
    }
  }

  const pendingMigrations = available
    .filter((migration) => !appliedByVersion.has(migration.version))
    .map(({ version, name, checksum }) => ({ version, name, checksum }));

  const appliedMigrations = [...appliedByVersion.values()].sort((left, right) =>
    left.version.localeCompare(right.version)
  );

  if (available.length === 0) {
    return {
      state: "unrecoverable",
      ready: false,
      migrationTablePresent,
      message:
        "No SQL migrations are available. Add versioned migrations before starting the service.",
      migrationsDir,
      availableMigrations: [],
      appliedMigrations,
      pendingMigrations,
      checksumMismatches,
      unknownAppliedVersions,
    };
  }

  if (!migrationTablePresent) {
    return {
      state: "missing_but_migratable",
      ready: false,
      migrationTablePresent: false,
      message:
        "schema_migrations table is missing. Run `npm run db:migrate` before starting the service.",
      migrationsDir,
      availableMigrations: available.map(({ version, name, checksum }) => ({ version, name, checksum })),
      appliedMigrations: [],
      pendingMigrations: available.map(({ version, name, checksum }) => ({ version, name, checksum })),
      checksumMismatches: [],
      unknownAppliedVersions: [],
    };
  }

  if (checksumMismatches.length > 0 || unknownAppliedVersions.length > 0) {
    return {
      state: "unrecoverable",
      ready: false,
      migrationTablePresent: true,
      message:
        "schema_migrations metadata does not match the migration files on disk. Restore or reconcile before starting the service.",
      migrationsDir,
      availableMigrations: available.map(({ version, name, checksum }) => ({ version, name, checksum })),
      appliedMigrations,
      pendingMigrations,
      checksumMismatches,
      unknownAppliedVersions,
    };
  }

  if (pendingMigrations.length > 0) {
    return {
      state: "migration_required",
      ready: false,
      migrationTablePresent: true,
      message:
        "Schema migrations are pending. Run `npm run db:migrate` before starting the service.",
      migrationsDir,
      availableMigrations: available.map(({ version, name, checksum }) => ({ version, name, checksum })),
      appliedMigrations,
      pendingMigrations,
      checksumMismatches,
      unknownAppliedVersions,
    };
  }

  return {
    state: "ready",
    ready: true,
    migrationTablePresent: true,
    message: "Schema is ready.",
    migrationsDir,
    availableMigrations: available.map(({ version, name, checksum }) => ({ version, name, checksum })),
    appliedMigrations,
    pendingMigrations: [],
    checksumMismatches,
    unknownAppliedVersions,
  };
}

async function inspectSchemaStatusFromClient(
  client: SchemaMigrationClient,
  migrationsDir: string
): Promise<SchemaMigrationStatus> {
  const available = await loadMigrationFiles(migrationsDir);
  const tableResult = await client.query<{ present: boolean | null }>(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present`
  );
  const migrationTablePresent = Boolean(tableResult.rows[0]?.present);
  if (!migrationTablePresent) {
    return buildStatus(migrationsDir, available, [], false);
  }

  const appliedResult = await client.query<SchemaMigrationRow>(
    `SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC`
  );
  return buildStatus(migrationsDir, available, appliedResult.rows, true);
}

export async function inspectSchemaStatus(
  connection: SchemaMigrationConnection,
  options: SchemaMigrationOptions = {}
): Promise<SchemaMigrationStatus> {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const client = await connection.connect();
  try {
    return await inspectSchemaStatusFromClient(client, migrationsDir);
  } finally {
    client.release();
  }
}

export function formatSchemaStatus(status: SchemaMigrationStatus): string {
  const pending = status.pendingMigrations.map((migration) => migration.version).join(", ");
  const applied = status.appliedMigrations.map((migration) => migration.version).join(", ");

  switch (status.state) {
    case "ready":
      return "Schema ready";
    case "missing_but_migratable":
      return "Schema metadata missing. Run `npm run db:migrate`.";
    case "migration_required":
      return `Schema migration required. Pending: ${pending || "none"}; applied: ${applied || "none"}`;
    case "unrecoverable":
      return `Schema state unrecoverable. ${status.message}`;
    default:
      return status.message;
  }
}

export async function assertSchemaReady(
  connection: SchemaMigrationConnection,
  options: SchemaMigrationOptions = {}
): Promise<SchemaMigrationStatus> {
  const status = await inspectSchemaStatus(connection, options);
  if (!status.ready) {
    throw new SchemaMigrationError(status);
  }
  return status;
}

async function ensureMetadataTable(client: SchemaMigrationClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function migrateSchema(
  connection: SchemaMigrationConnection,
  options: SchemaMigrationOptions = {}
): Promise<SchemaMigrationStatus> {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const client = await connection.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('bobbyexecute_schema_migrations')::bigint)`);
    await ensureMetadataTable(client);
    const available = await loadMigrationFiles(migrationsDir);
    const appliedResult = await client.query<SchemaMigrationRow>(
      `SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC`
    );
    const status = buildStatus(migrationsDir, available, appliedResult.rows, true);

    if (status.state === "unrecoverable") {
      throw new SchemaMigrationError(status);
    }

    const appliedVersions = new Set(status.appliedMigrations.map((migration) => migration.version));
    for (const migration of available) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        `
          INSERT INTO schema_migrations (version, name, checksum, applied_at)
          VALUES ($1, $2, $3, NOW())
        `,
        [migration.version, migration.name, migration.checksum]
      );
    }

    await client.query("COMMIT");
    const finalResult = await client.query<SchemaMigrationRow>(
      `SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC`
    );
    return buildStatus(migrationsDir, available, finalResult.rows, true);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
