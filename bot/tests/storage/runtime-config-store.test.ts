import { describe, expect, it } from "vitest";
import { createRuntimeConfigStore, InMemoryRuntimeConfigStore } from "../../src/storage/runtime-config-store.js";

describe("runtime config store", () => {
  it("falls back to the in-memory store when REDIS_URL is not configured", async () => {
    const store = await createRuntimeConfigStore();
    expect(store.kind).toBe("memory");
  });

  it("round-trips runtime signal state, including version pointers and pause/kill flags", async () => {
    const store = new InMemoryRuntimeConfigStore();
    const state = {
      reloadNonce: 3,
      paused: true,
      pauseScope: "hard" as const,
      pauseReason: "maintenance hold",
      killSwitch: true,
      killSwitchReason: "incident",
      lastAppliedVersionId: "runtime-config-v2",
      lastValidVersionId: "runtime-config-v2",
      pendingApply: true,
      pendingReason: "queued until cycle boundary",
    };

    await store.writeState(state);
    expect(await store.readState()).toMatchObject(state);
    expect(store.loadSync()).toMatchObject(state);

    store.saveSync({
      ...state,
      reloadNonce: 4,
      paused: false,
      pauseScope: undefined,
      pauseReason: undefined,
      killSwitch: false,
      killSwitchReason: undefined,
      lastAppliedVersionId: "runtime-config-v3",
      lastValidVersionId: "runtime-config-v3",
      pendingApply: false,
      pendingReason: undefined,
    });

    expect(store.loadSync()).toMatchObject({
      reloadNonce: 4,
      paused: false,
      killSwitch: false,
      lastAppliedVersionId: "runtime-config-v3",
      lastValidVersionId: "runtime-config-v3",
      pendingApply: false,
    });
  });
});
