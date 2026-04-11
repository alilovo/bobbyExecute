import { formatSchemaStatus, migrateSchema } from "../persistence/schema-migrations.js";
import { createPostgresPool } from "../persistence/postgres-pool.js";
import { closePool, parseCliArgs, readCliString } from "./cli.js";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const directUrl =
    readCliString(args, "direct-url", process.env.DIRECT_URL) ??
    readCliString(args, "database-url", process.env.DATABASE_URL);
  const databaseUrl = directUrl;
  const migrationsDir = readCliString(args, "migrations-dir");

  if (!databaseUrl) {
    console.error("DIRECT_URL or DATABASE_URL is required.");
    return 4;
  }

  const pool = createPostgresPool(databaseUrl);
  try {
    const status = await migrateSchema(pool, migrationsDir ? { migrationsDir } : {});
    console.log(formatSchemaStatus(status));
    console.log(JSON.stringify(status, null, 2));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && "status" in error) {
      console.error(JSON.stringify((error as { status?: unknown }).status ?? null, null, 2));
    }
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
