import { readFile } from "node:fs/promises";
import {
  restoreControlPlaneBackup,
  type ControlPlaneBackupSnapshot,
  summarizeControlPlaneBackup,
} from "../recovery/control-plane-backup.js";
import { createPostgresPool } from "../persistence/postgres-pool.js";
import { closePool, parseCliArgs, readCliString } from "./cli.js";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const databaseUrl = readCliString(args, "database-url", process.env.DATABASE_URL);
  const inputPath = readCliString(args, "input");

  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    return 4;
  }
  if (!inputPath) {
    console.error("An input backup file is required.");
    return 4;
  }

  const pool = createPostgresPool(databaseUrl);
  try {
    const snapshot = JSON.parse(await readFile(inputPath, "utf8")) as ControlPlaneBackupSnapshot;
    await restoreControlPlaneBackup(pool, snapshot);
    console.log(JSON.stringify(summarizeControlPlaneBackup(snapshot), null, 2));
    return 0;
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
