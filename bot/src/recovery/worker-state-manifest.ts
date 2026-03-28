import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Config } from "../config/config-schema.js";

export type WorkerDiskArtifactCategory =
  | "canonical_durable_state"
  | "reconstructible_derivative_state"
  | "operational_evidence"
  | "transient_no_recovery_needed";

export interface WorkerDiskArtifactDescriptor {
  path: string;
  label: string;
  category: WorkerDiskArtifactCategory;
  bootCritical: boolean;
  requiredForRecoveryDrill: boolean;
  optionalInPaperMode: boolean;
  recoveryExpectation: string;
  lostArtifactImpact: string;
  present: boolean;
}

export interface WorkerDiskRecoveryReport {
  basePath: string;
  journalPath: string;
  artifacts: WorkerDiskArtifactDescriptor[];
  bootCriticalMissing: WorkerDiskArtifactDescriptor[];
  recoveryDrillMissing: WorkerDiskArtifactDescriptor[];
  safeBoot: boolean;
  message: string;
}

function stripJsonlSuffix(path: string): string {
  return path.replace(/\.jsonl$/i, "");
}

function buildArtifact(
  path: string,
  input: Omit<WorkerDiskArtifactDescriptor, "path" | "present"> & { present?: boolean }
): WorkerDiskArtifactDescriptor {
  return {
    path,
    present: input.present ?? false,
    label: input.label,
    category: input.category,
    bootCritical: input.bootCritical,
    requiredForRecoveryDrill: input.requiredForRecoveryDrill,
    optionalInPaperMode: input.optionalInPaperMode,
    recoveryExpectation: input.recoveryExpectation,
    lostArtifactImpact: input.lostArtifactImpact,
  };
}

export function getWorkerDiskArtifacts(config: Pick<Config, "journalPath">): WorkerDiskArtifactDescriptor[] {
  const basePath = stripJsonlSuffix(config.journalPath);
  const directory = dirname(basePath);
  return [
    buildArtifact(config.journalPath, {
      label: "worker journal",
      category: "operational_evidence",
      bootCritical: false,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Retain the append-only journal for audit and replay review.",
      lostArtifactImpact: "Evidence gap only. The worker can still boot, but historical replay fidelity is reduced.",
      present: existsSync(config.journalPath),
    }),
    buildArtifact(join(directory, `${basePath.split(/[\\/]/).pop() ?? "journal"}.actions.jsonl`), {
      label: "paper action log",
      category: "operational_evidence",
      bootCritical: false,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: true,
      recoveryExpectation: "Retain when paper mode is used; it is operator evidence, not control truth.",
      lostArtifactImpact: "Paper-mode evidence gap only. Safe boot is unaffected.",
      present: existsSync(join(directory, `${basePath.split(/[\\/]/).pop() ?? "journal"}.actions.jsonl`)),
    }),
    buildArtifact(`${basePath}.runtime-cycles.jsonl`, {
      label: "runtime cycle summary stream",
      category: "reconstructible_derivative_state",
      bootCritical: false,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Retain for incident review. If lost, later cycles are still safe, but the historical slice is gone.",
      lostArtifactImpact: "Historical reconstruction gap only.",
      present: existsSync(`${basePath}.runtime-cycles.jsonl`),
    }),
    buildArtifact(`${basePath}.incidents.jsonl`, {
      label: "incident journal",
      category: "operational_evidence",
      bootCritical: false,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Retain as operator evidence. It is not authoritative control state.",
      lostArtifactImpact: "Incident evidence gap only.",
      present: existsSync(`${basePath}.incidents.jsonl`),
    }),
    buildArtifact(`${basePath}.execution-evidence.jsonl`, {
      label: "execution evidence",
      category: "operational_evidence",
      bootCritical: false,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Retain to preserve execution auditability and replay context.",
      lostArtifactImpact: "Execution evidence gap only.",
      present: existsSync(`${basePath}.execution-evidence.jsonl`),
    }),
    buildArtifact(`${basePath}.kill-switch.json`, {
      label: "kill switch state",
      category: "canonical_durable_state",
      bootCritical: true,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Restore exact state before boot. If absent, the worker must fail closed.",
      lostArtifactImpact: "Safe boot is blocked until the operator restores or re-arms the state.",
      present: existsSync(`${basePath}.kill-switch.json`),
    }),
    buildArtifact(`${basePath}.live-control.json`, {
      label: "live control state",
      category: "canonical_durable_state",
      bootCritical: true,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Restore exact state before boot. The worker cannot infer live-control truth from Postgres.",
      lostArtifactImpact: "Safe boot is blocked until the operator restores or re-seeds the state explicitly.",
      present: existsSync(`${basePath}.live-control.json`),
    }),
    buildArtifact(`${basePath}.daily-loss.json`, {
      label: "daily loss state",
      category: "canonical_durable_state",
      bootCritical: true,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Restore exact state before boot. Loss accounting must not be guessed.",
      lostArtifactImpact: "Safe boot is blocked until the operator restores or re-seeds the state explicitly.",
      present: existsSync(`${basePath}.daily-loss.json`),
    }),
    buildArtifact(`${basePath}.idempotency.json`, {
      label: "idempotency cache",
      category: "canonical_durable_state",
      bootCritical: true,
      requiredForRecoveryDrill: true,
      optionalInPaperMode: false,
      recoveryExpectation: "Restore exact state before boot. Duplicate suppression is safety-critical in live posture.",
      lostArtifactImpact: "Safe boot is blocked until the operator restores or re-seeds the state explicitly.",
      present: existsSync(`${basePath}.idempotency.json`),
    }),
  ];
}

export function inspectWorkerDiskRecovery(config: Pick<Config, "journalPath">): WorkerDiskRecoveryReport {
  const artifacts = getWorkerDiskArtifacts(config);
  const bootCriticalMissing = artifacts.filter((artifact) => artifact.bootCritical && !artifact.present);
  const recoveryDrillMissing = artifacts.filter((artifact) => artifact.requiredForRecoveryDrill && !artifact.present);
  const safeBoot = bootCriticalMissing.length === 0;
  const message = safeBoot
    ? "Worker disk recovery prerequisites are present."
    : "Worker disk recovery prerequisites are missing. The worker must fail closed until the state is restored.";

  return {
    basePath: stripJsonlSuffix(config.journalPath),
    journalPath: config.journalPath,
    artifacts,
    bootCriticalMissing,
    recoveryDrillMissing,
    safeBoot,
    message,
  };
}

