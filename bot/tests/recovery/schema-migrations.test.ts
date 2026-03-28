import { describe, expect, it } from "vitest";
import {
  assertSchemaReady,
  formatSchemaStatus,
  inspectSchemaStatus,
  migrateSchema,
  type SchemaMigrationClient,
  type SchemaMigrationConnection,
  type SchemaMigrationRow,
  SchemaMigrationError,
} from "../../src/persistence/schema-migrations.js";

class MemoryMigrationClient implements SchemaMigrationClient {
  constructor(private readonly state: MemoryMigrationState) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = []
  ): Promise<{ rows: T[] }> {
    const sql = text.trim();

    if (sql.startsWith("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present")) {
      return { rows: [{ present: this.state.schemaPresent } as T] };
    }

    if (sql.startsWith("SELECT version, name, checksum, applied_at FROM schema_migrations")) {
      return {
        rows: [...this.state.appliedRows]
          .sort((left, right) => left.version.localeCompare(right.version))
          .map((row) => ({ ...row }) as T),
      };
    }

    if (sql.startsWith("CREATE TABLE IF NOT EXISTS schema_migrations")) {
      this.state.schemaPresent = true;
      return { rows: [] };
    }

    if (sql.startsWith("INSERT INTO schema_migrations")) {
      const [version, name, checksum] = params as [string, string, string];
      const existing = this.state.appliedRows.find((row) => row.version === version);
      const row: SchemaMigrationRow = {
        version,
        name,
        checksum,
        applied_at: new Date().toISOString(),
      };
      if (existing) {
        Object.assign(existing, row);
      } else {
        this.state.appliedRows.push(row);
      }
      return { rows: [] };
    }

    if (
      sql === "BEGIN" ||
      sql === "COMMIT" ||
      sql === "ROLLBACK" ||
      sql.startsWith("SELECT pg_advisory_xact_lock(") ||
      sql.startsWith("CREATE TABLE IF NOT EXISTS") ||
      sql.startsWith("CREATE INDEX IF NOT EXISTS") ||
      sql.startsWith("ALTER TABLE")
    ) {
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in migration test: ${sql}`);
  }

  release(): void {}
}

interface MemoryMigrationState {
  schemaPresent: boolean;
  appliedRows: SchemaMigrationRow[];
}

class MemoryMigrationConnection implements SchemaMigrationConnection {
  readonly state: MemoryMigrationState = {
    schemaPresent: false,
    appliedRows: [],
  };

  async connect(): Promise<SchemaMigrationClient> {
    return new MemoryMigrationClient(this.state);
  }
}

describe("schema migrations", () => {
  it("reports missing metadata as migratable and keeps the error explicit", async () => {
    const connection = new MemoryMigrationConnection();
    const status = await inspectSchemaStatus(connection);

    expect(status.state).toBe("missing_but_migratable");
    expect(status.ready).toBe(false);
    expect(status.availableMigrations.length).toBeGreaterThan(0);
    expect(formatSchemaStatus(status)).toContain("Run `npm run db:migrate`");

    await expect(assertSchemaReady(connection)).rejects.toBeInstanceOf(SchemaMigrationError);
  });

  it("applies migrations once and stays idempotent on rerun", async () => {
    const connection = new MemoryMigrationConnection();

    const first = await migrateSchema(connection);
    expect(first.ready).toBe(true);
    expect(first.state).toBe("ready");
    expect(connection.state.schemaPresent).toBe(true);
    expect(connection.state.appliedRows).toHaveLength(first.availableMigrations.length);

    const second = await migrateSchema(connection);
    expect(second.ready).toBe(true);
    expect(second.availableMigrations).toHaveLength(first.availableMigrations.length);
    expect(connection.state.appliedRows).toHaveLength(first.availableMigrations.length);
  });

  it("reports version mismatch as unrecoverable", async () => {
    const seeded = new MemoryMigrationConnection();
    const available = (await inspectSchemaStatus(seeded)).availableMigrations;
    const target = new MemoryMigrationConnection();
    target.state.schemaPresent = true;
    target.state.appliedRows = [
      {
        version: available[0].version,
        name: available[0].name,
        checksum: `${available[0].checksum}-tampered`,
        applied_at: new Date().toISOString(),
      },
    ];

    const status = await inspectSchemaStatus(target);
    expect(status.state).toBe("unrecoverable");
    expect(status.checksumMismatches).toHaveLength(1);
    expect(status.message).toContain("does not match");
  });
});

