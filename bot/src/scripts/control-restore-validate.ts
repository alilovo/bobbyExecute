import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import {
  validateControlPlaneBackupRoundTrip,
  type ControlPlaneBackupSnapshot,
} from "../recovery/control-plane-backup.js";
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

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const snapshot = JSON.parse(await readFile(inputPath, "utf8")) as ControlPlaneBackupSnapshot;
    const result = await validateControlPlaneBackupRoundTrip(pool, snapshot);
    console.log(JSON.stringify(result, null, 2));
    return result.matched ? 0 : 2;
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
