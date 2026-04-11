import { formatSchemaStatus, inspectSchemaStatus } from "../persistence/schema-migrations.js";
import { createPostgresPool } from "../persistence/postgres-pool.js";
import { closePool, parseCliArgs, readCliString } from "./cli.js";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const databaseUrl = readCliString(args, "database-url", process.env.DATABASE_URL);
  const migrationsDir = readCliString(args, "migrations-dir");

  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    return 4;
  }

  const pool = createPostgresPool(databaseUrl);
  try {
    const status = await inspectSchemaStatus(pool, migrationsDir ? { migrationsDir } : {});
    const payload = JSON.stringify(status, null, 2);
    console.log(formatSchemaStatus(status));
    console.log(payload);
    switch (status.state) {
      case "ready":
        return 0;
      case "missing_but_migratable":
      case "migration_required":
        return 2;
      case "unrecoverable":
        return 3;
      default:
        return 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    await closePool(pool);
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
