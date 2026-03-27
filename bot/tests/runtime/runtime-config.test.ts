import { describe, expect, it } from "vitest";
import { createRuntimeConfigTestManager } from "../helpers/runtime-config-test-kit.js";

describe("runtime config safe apply boundary", () => {
  it("defers hot config application until the cycle boundary and then promotes the pending snapshot", async () => {
    const { manager, store } = await createRuntimeConfigTestManager();
    const before = manager.getRuntimeConfigStatus();

    manager.beginCycle();
    const result = await manager.applyBehaviorPatch({
      patch: {
        filters: {
          allowlistTokens: ["SOL"],
        },
      },
      actor: "operator",
      reason: "queue filter update",
    });

    expect(result.accepted).toBe(true);
    expect(result.appliedVersionId).toBe(before.appliedVersionId);

    const pending = manager.getRuntimeConfigStatus();
    expect(pending.pendingApply).toBe(true);
    expect(pending.appliedVersionId).toBe(before.appliedVersionId);
    expect(pending.requestedVersionId).not.toBe(before.requestedVersionId);
    expect(pending.filters.allowlistTokens).toEqual([]);
    expect(store.loadSync()).toMatchObject({
      lastAppliedVersionId: before.appliedVersionId,
      lastValidVersionId: before.lastValidVersionId,
    });

    await manager.endCycle();

    const applied = manager.getRuntimeConfigStatus();
    expect(applied.pendingApply).toBe(false);
    expect(applied.appliedVersionId).not.toBe(before.appliedVersionId);
    expect(applied.appliedVersionId).toBe(applied.lastValidVersionId);
    expect(applied.filters.allowlistTokens).toEqual(["SOL"]);
    expect(store.loadSync()).toMatchObject({
      lastAppliedVersionId: applied.appliedVersionId,
      lastValidVersionId: applied.lastValidVersionId,
      pendingApply: false,
    });
  });
});
