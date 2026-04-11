import { readFile } from "node:fs/promises";
import { PostgresControlGovernanceRepository } from "../persistence/control-governance-repository.js";
import { createPostgresPool } from "../persistence/postgres-pool.js";
import {
  runDisposableDatabaseRehearsal,
  type DisposableDatabaseRehearsalResult,
} from "../recovery/disposable-db-rehearsal.js";
import type { ControlPlaneBackupSnapshot } from "../recovery/control-plane-backup.js";
import { closePool, parseCliArgs, readCliString } from "./cli.js";

function buildContextKind(value: string | undefined, fallback: "canonical" | "disposable" | "staging" | "unknown"): "canonical" | "disposable" | "staging" | "unknown" {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "canonical" || normalized === "disposable" || normalized === "staging" || normalized === "unknown") {
    return normalized;
  }
  throw new Error(`invalid rehearsal context kind: ${value}`);
}

function parseActorRole(value: string | undefined): "viewer" | "operator" | "admin" {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "admin") {
    return "admin";
  }
  if (normalized === "viewer" || normalized === "operator") {
    return normalized;
  }
  throw new Error(`invalid actor role: ${value}`);
}

function validateCliConfig(input: {
  sourceDatabaseUrl?: string;
  targetDatabaseUrl?: string;
  sourceContext?: string;
  targetContext?: string;
  targetKind?: string;
}): void {
  if (!input.sourceDatabaseUrl) {
    throw new Error("source database URL is required.");
  }
  if (!input.targetDatabaseUrl) {
    throw new Error("target database URL is required.");
  }
  if (!input.sourceContext) {
    throw new Error("source context label is required.");
  }
  if (!input.targetContext) {
    throw new Error("target context label is required.");
  }
  if ((input.targetKind ?? "disposable").trim().toLowerCase() !== "disposable") {
    throw new Error("target kind must be 'disposable'.");
  }
  if (input.sourceDatabaseUrl.trim() === input.targetDatabaseUrl.trim()) {
    throw new Error("source and target database URLs are identical; refusing to run the disposable rehearsal.");
  }
}

async function loadSnapshot(inputPath: string | undefined): Promise<ControlPlaneBackupSnapshot | undefined> {
  if (!inputPath) {
    return undefined;
  }
  const raw = await readFile(inputPath, "utf8");
  return JSON.parse(raw) as ControlPlaneBackupSnapshot;
}

function printResult(result: DisposableDatabaseRehearsalResult): void {
  console.log(JSON.stringify(result, null, 2));
  console.log(result.summary);
}

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  let sourceDatabaseUrl = "";
  let targetDatabaseUrl = "";
  let sourceContext = "";
  let targetContext = "";
  let sourceKind: "canonical" | "disposable" | "staging" | "unknown" = "canonical";
  let targetKind: "canonical" | "disposable" | "staging" | "unknown" = "disposable";
  let environment = "development";
  let actorId = "rehearsal-runner";
  let displayName = "rehearsal-runner";
  let role: "viewer" | "operator" | "admin" = "admin";
  let sessionId = `rehearsal-${Date.now()}`;
  let migrationsDir: string | undefined;
  let sourceSnapshot: ControlPlaneBackupSnapshot | undefined;

  try {
    sourceDatabaseUrl = readCliString(args, "source-database-url", process.env.SOURCE_DATABASE_URL) ?? "";
    targetDatabaseUrl = readCliString(args, "target-database-url", process.env.TARGET_DATABASE_URL) ?? "";
    sourceContext = readCliString(args, "source-context", "canonical-production") ?? "";
    targetContext = readCliString(args, "target-context", "disposable-rehearsal") ?? "";
    sourceKind = buildContextKind(readCliString(args, "source-kind", "canonical"), "canonical");
    targetKind = buildContextKind(readCliString(args, "target-kind", "disposable"), "disposable");
    environment = readCliString(args, "environment", process.env.RUNTIME_CONFIG_ENV ?? process.env.NODE_ENV ?? "development") ?? "development";
    actorId = readCliString(args, "actor-id", process.env.REHEARSAL_ACTOR_ID ?? process.env.USER ?? "rehearsal-runner") ?? "rehearsal-runner";
    displayName = readCliString(args, "actor-display-name", process.env.REHEARSAL_ACTOR_DISPLAY_NAME ?? actorId) ?? actorId;
    role = parseActorRole(readCliString(args, "actor-role", "admin"));
    sessionId = readCliString(args, "session-id", process.env.REHEARSAL_SESSION_ID ?? `rehearsal-${Date.now()}`) ?? `rehearsal-${Date.now()}`;
    migrationsDir = readCliString(args, "migrations-dir");
    sourceSnapshot = await loadSnapshot(readCliString(args, "input"));

    validateCliConfig({
      sourceDatabaseUrl,
      targetDatabaseUrl,
      sourceContext,
      targetContext,
      targetKind: readCliString(args, "target-kind", "disposable"),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 4;
  }

  const sourcePool = createPostgresPool(sourceDatabaseUrl);
  const targetPool = createPostgresPool(targetDatabaseUrl);
  const evidenceRepository = new PostgresControlGovernanceRepository(sourcePool);

  try {
    const result = await runDisposableDatabaseRehearsal({
      environment,
      sourceConnection: sourcePool,
      targetConnection: targetPool,
      evidenceRepository,
      sourceContext: { label: sourceContext, kind: sourceKind },
      targetContext: { label: targetContext, kind: targetKind },
      actor: {
        actorId,
        displayName,
        role,
        sessionId,
      },
      sourceDatabaseUrl,
      targetDatabaseUrl,
      migrationsDir,
      rehearsalId: readCliString(args, "rehearsal-id"),
      sourceSnapshot,
    });
    printResult(result);
    return result.success ? 0 : 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    await closePool(targetPool);
    await closePool(sourcePool);
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
