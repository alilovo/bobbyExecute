import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { inspectWorkerDiskRecovery } from "../../src/recovery/worker-state-manifest.js";

async function writeFileIfNeeded(path: string, content = "{}\n"): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}

describe("worker state manifest", () => {
  it("classifies boot-critical worker state and fails closed when it is missing", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "bobbyexecute-worker-state-"));
    try {
      const journalPath = join(baseDir, "journal.jsonl");
      await writeFileIfNeeded(journalPath, "{\"event\":\"journal\"}\n");
      await writeFileIfNeeded(join(baseDir, "journal.actions.jsonl"), "{\"event\":\"action\"}\n");

      const bootableReport = inspectWorkerDiskRecovery({ journalPath });
      expect(bootableReport.safeBoot).toBe(false);
      expect(bootableReport.bootCriticalMissing.map((artifact) => artifact.label)).toEqual(
        expect.arrayContaining([
          "kill switch state",
          "live control state",
          "daily loss state",
          "idempotency cache",
        ])
      );
      expect(bootableReport.artifacts.find((artifact) => artifact.path === journalPath)?.category).toBe(
        "operational_evidence"
      );
      expect(
        bootableReport.artifacts.find((artifact) => artifact.path === join(baseDir, "journal.actions.jsonl"))?.category
      ).toBe("operational_evidence");

      await writeFileIfNeeded(join(baseDir, "journal.kill-switch.json"));
      await writeFileIfNeeded(join(baseDir, "journal.live-control.json"));
      await writeFileIfNeeded(join(baseDir, "journal.daily-loss.json"));
      await writeFileIfNeeded(join(baseDir, "journal.idempotency.json"));

      const safeReport = inspectWorkerDiskRecovery({ journalPath });
      expect(safeReport.safeBoot).toBe(true);
      expect(safeReport.bootCriticalMissing).toHaveLength(0);
      expect(safeReport.recoveryDrillMissing.length).toBeGreaterThan(0);
      expect(safeReport.message).toContain("present");
    } finally {
      await rm(baseDir, { recursive: true, force: true });
    }
  });
});
