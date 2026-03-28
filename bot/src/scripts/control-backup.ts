import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import {
  captureControlPlaneBackup,
  summarizeControlPlaneBackup,
} from "../recovery/control-plane-backup.js";
import { closePool, parseCliArgs, readCliString } from "./cli.js";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const databaseUrl = readCliString(args, "database-url", process.env.DATABASE_URL);
  const environment =
    readCliString(args, "environment", process.env.RUNTIME_CONFIG_ENV ?? process.env.RENDER_SERVICE_NAME ?? process.env.NODE_ENV) ??
    "development";
  const migrationsDir = readCliString(args, "migrations-dir");
  const outputPath = readCliString(args, "output");

  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    return 4;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const snapshot = await captureControlPlaneBackup(pool, environment, migrationsDir ? { migrationsDir } : {});
    const summary = summarizeControlPlaneBackup(snapshot);
    const payload = JSON.stringify(snapshot, null, 2);

    if (outputPath) {
      await writeFile(outputPath, `${payload}\n`, "utf8");
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(payload);
    }

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
