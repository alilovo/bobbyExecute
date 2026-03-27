import { describe, expect, it } from "vitest";
import { createRuntimeConfigTestManager } from "../helpers/runtime-config-test-kit.js";

describe("runtime config manager", () => {
  it("seeds a safe runtime config snapshot from boot config", async () => {
    const { manager, store } = await createRuntimeConfigTestManager();

    const status = manager.getRuntimeConfigStatus();
    const document = manager.getRuntimeConfigDocument();
    const history = await manager.getHistory();

    expect(status).toMatchObject({
      environment: "runtime-config-test",
      configured: true,
      seedSource: "boot",
      requestedMode: "observe",
      appliedMode: "observe",
      requestedExecutionMode: "dry",
      appliedExecutionMode: "dry",
      paused: false,
      killSwitch: false,
      pendingApply: false,
    });
    expect(status.lastValidVersionId).toBe(status.appliedVersionId);
    expect(document.behavior.mode).toBe("observe");
    expect(document.overlay.killSwitch).toBe(false);
    expect(history.versions).toHaveLength(1);
    expect(history.changes).toHaveLength(1);
    expect(history.changes[0]).toMatchObject({
      action: "seed",
      accepted: true,
      resultVersionId: status.appliedVersionId,
    });
    expect(store.loadSync()).toMatchObject({
      reloadNonce: 0,
      paused: false,
      killSwitch: false,
      pendingApply: false,
      lastAppliedVersionId: status.appliedVersionId,
      lastValidVersionId: status.appliedVersionId,
    });
  });

  it("activates a valid runtime config patch and records a new version", async () => {
    const { manager, store } = await createRuntimeConfigTestManager();
    const before = manager.getRuntimeConfigStatus();

    const result = await manager.applyBehaviorPatch({
      patch: {
        filters: {
          allowlistTokens: ["SOL", "USDC"],
          denylistTokens: ["SCAM"],
        },
        thresholds: {
          maxSlippagePercent: 7,
        },
      },
      actor: "operator-a",
      reason: "tune filters",
    });

    expect(result.accepted).toBe(true);
    expect(result.appliedVersionId).not.toBe(before.appliedVersionId);

    const status = manager.getRuntimeConfigStatus();
    expect(status.filters.allowlistTokens).toEqual(["SOL", "USDC"]);
    expect(status.filters.denylistTokens).toEqual(["SCAM"]);
    expect(status.thresholds.maxSlippagePercent).toBe(7);
    expect(status.pendingApply).toBe(false);
    expect(status.lastValidVersionId).toBe(status.appliedVersionId);
    expect(store.loadSync()).toMatchObject({
      lastAppliedVersionId: status.appliedVersionId,
      lastValidVersionId: status.lastValidVersionId,
      reloadNonce: status.reloadNonce,
    });

    const history = await manager.getHistory();
    expect(history.versions).toHaveLength(2);
    expect(history.changes[0]).toMatchObject({
      action: "runtime_config",
      accepted: true,
      resultVersionId: status.appliedVersionId,
    });
  });

  it("rejects an invalid runtime config patch and keeps the last valid config active", async () => {
    const { manager } = await createRuntimeConfigTestManager();
    const before = manager.getRuntimeConfigStatus();

    const result = await manager.applyBehaviorPatch({
      patch: {
        mode: "bogus" as never,
      },
      actor: "operator-b",
      reason: "invalid mode",
    });

    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toMatch(/invalid/i);

    const after = manager.getRuntimeConfigStatus();
    expect(after.requestedMode).toBe(before.requestedMode);
    expect(after.appliedMode).toBe(before.appliedMode);
    expect(after.lastValidVersionId).toBe(before.lastValidVersionId);
    expect(after.appliedVersionId).toBe(before.appliedVersionId);
    expect(after.pendingApply).toBe(false);

    const history = await manager.getHistory();
    expect(history.versions).toHaveLength(1);
    expect(history.changes[0]).toMatchObject({
      action: "runtime_config",
      accepted: false,
      rejectionReason: expect.stringMatching(/invalid/i),
    });
  });

  it("accepts a mode change but keeps applied mode stable until the restart boundary", async () => {
    const { manager } = await createRuntimeConfigTestManager();
    const before = manager.getRuntimeConfigStatus();

    const result = await manager.setMode("paper", {
      actor: "operator-c",
      reason: "move to paper",
    });

    expect(result.accepted).toBe(true);

    const status = manager.getRuntimeConfigStatus();
    expect(status.requestedMode).toBe("paper");
    expect(status.appliedMode).toBe(before.appliedMode);
    expect(status.pendingApply).toBe(true);
    expect(status.requiresRestart).toBe(true);
    expect(status.requestedVersionId).not.toBe(before.requestedVersionId);
    expect(status.appliedVersionId).toBe(before.appliedVersionId);
    expect(status.lastValidVersionId).toBe(before.lastValidVersionId);
  });

  it("supports pause, resume, kill switch, and reload semantics without env edits", async () => {
    const { manager, store } = await createRuntimeConfigTestManager();

    const pause = await manager.setPause({
      scope: "soft",
      actor: "operator-d",
      reason: "maintenance window",
    });
    expect(pause.accepted).toBe(true);
    expect(manager.getRuntimeConfigStatus()).toMatchObject({
      paused: true,
      pauseScope: "soft",
      pauseReason: "maintenance window",
      killSwitch: false,
    });

    const resume = await manager.resume({
      actor: "operator-d",
      reason: "maintenance complete",
    });
    expect(resume.accepted).toBe(true);
    expect(manager.getRuntimeConfigStatus()).toMatchObject({
      paused: false,
      pauseScope: undefined,
      killSwitch: false,
    });

    const trigger = await manager.setKillSwitch({
      action: "trigger",
      actor: "operator-d",
      reason: "incident",
    });
    expect(trigger.accepted).toBe(true);
    expect(manager.getRuntimeConfigStatus()).toMatchObject({
      killSwitch: true,
      paused: true,
      pauseScope: "hard",
      pauseReason: "incident",
    });

    const reset = await manager.setKillSwitch({
      action: "reset",
      actor: "operator-d",
      reason: "incident cleared",
    });
    expect(reset.accepted).toBe(true);
    expect(manager.getRuntimeConfigStatus()).toMatchObject({
      killSwitch: false,
      paused: true,
    });

    const resumeAfterReset = await manager.resume({
      actor: "operator-d",
      reason: "resume after reset",
    });
    expect(resumeAfterReset.accepted).toBe(true);
    expect(manager.getRuntimeConfigStatus()).toMatchObject({
      killSwitch: false,
      paused: false,
    });

    const reloadBefore = manager.getRuntimeConfigStatus();
    const reload = await manager.reload({
      actor: "operator-d",
      reason: "manual reload",
    });
    expect(reload.accepted).toBe(true);

    const reloaded = manager.getRuntimeConfigStatus();
    expect(reloaded.reloadNonce).toBe(reloadBefore.reloadNonce + 1);
    expect(reloaded.appliedVersionId).toBe(reloadBefore.appliedVersionId);
    expect(reloaded.lastValidVersionId).toBe(reloadBefore.lastValidVersionId);
    expect(store.loadSync()).toMatchObject({
      reloadNonce: reloaded.reloadNonce,
      lastAppliedVersionId: reloaded.appliedVersionId,
      lastValidVersionId: reloaded.lastValidVersionId,
    });

    const history = await manager.getHistory();
    expect(history.changes[0]).toMatchObject({ action: "reload", accepted: true });
    expect(history.changes.some((entry) => entry.action === "pause" && entry.accepted)).toBe(true);
    expect(history.changes.some((entry) => entry.action === "kill_switch" && entry.accepted)).toBe(true);
    expect(history.changes.some((entry) => entry.action === "resume" && entry.accepted)).toBe(true);
  });
});
