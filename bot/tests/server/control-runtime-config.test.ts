import { afterEach, describe, expect, it } from "vitest";
import { createControlServer } from "../../src/server/index.js";
import { createRuntimeConfigTestManager, controlHeaders, TEST_CONTROL_TOKEN } from "../helpers/runtime-config-test-kit.js";

async function createHarness() {
  const { manager } = await createRuntimeConfigTestManager();
  const server = await createControlServer({
    port: 0,
    host: "127.0.0.1",
    runtimeConfigManager: manager,
    controlAuthToken: TEST_CONTROL_TOKEN,
  });
  const address = server.server.address();
  if (typeof address !== "object" || address === null || !("port" in address)) {
    throw new Error("Failed to resolve test server port");
  }

  return {
    manager,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe("control runtime-config routes", () => {
  let servers: Array<Awaited<ReturnType<typeof createHarness>>> = [];

  afterEach(async () => {
    for (const harness of [...servers].reverse()) {
      await harness.server.close();
    }
    servers = [];
  });

  it("rejects mutations without operator auth and logs the denial", async () => {
    const harness = await createHarness();
    servers.push(harness);

    const response = await fetch(`${harness.baseUrl}/control/runtime-config`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patch: {
          filters: { allowlistTokens: ["SOL"] },
        },
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "control_auth_invalid",
    });

    const history = await harness.manager.getHistory();
    expect(history.changes[0]).toMatchObject({
      action: "auth_failure",
      accepted: false,
    });
  });

  it("returns the runtime config control view and surfaces pending mode changes", async () => {
    const harness = await createHarness();
    servers.push(harness);

    const readResponse = await fetch(`${harness.baseUrl}/control/runtime-config`, {
      headers: controlHeaders(),
    });
    expect(readResponse.status).toBe(200);
    const readBody = await readResponse.json();
    expect(readBody).toMatchObject({
      success: true,
      runtimeConfig: {
        requestedMode: "observe",
        appliedMode: "observe",
        pendingApply: false,
      },
      controlView: {
        requestedMode: "observe",
        appliedMode: "observe",
      },
    });

    const modeResponse = await fetch(`${harness.baseUrl}/control/mode`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: "paper",
        reason: "move to paper",
      }),
    });
    expect(modeResponse.status).toBe(200);
    const modeBody = await modeResponse.json();
    expect(modeBody).toMatchObject({
      success: true,
      accepted: true,
      action: "runtime_config",
      pendingApply: true,
      requiresRestart: true,
      runtimeConfig: {
        requestedMode: "paper",
        appliedMode: "observe",
      },
      status: {
        requestedMode: "paper",
        appliedMode: "observe",
        pendingApply: true,
        requiresRestart: true,
      },
    });

    const statusResponse = await fetch(`${harness.baseUrl}/control/runtime-status`, {
      headers: controlHeaders(),
    });
    expect(statusResponse.status).toBe(200);
    const statusBody = await statusResponse.json();
    expect(statusBody).toMatchObject({
      success: true,
      runtimeConfig: {
        requestedMode: "paper",
        appliedMode: "observe",
        pendingApply: true,
        requiresRestart: true,
      },
      controlView: {
        requestedMode: "paper",
        appliedMode: "observe",
        pendingApply: true,
        requiresRestart: true,
      },
    });
  });

  it("applies pause, resume, kill switch, reload, and runtime-config changes through the control surface", async () => {
    const harness = await createHarness();
    servers.push(harness);

    const patchResponse = await fetch(`${harness.baseUrl}/control/runtime-config`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        patch: {
          filters: {
            allowlistTokens: ["SOL", "USDC"],
            denylistTokens: ["SCAM"],
          },
          thresholds: {
            maxSlippagePercent: 6,
          },
        },
        reason: "tune filters",
      }),
    });
    expect(patchResponse.status).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        filters: {
          allowlistTokens: ["SOL", "USDC"],
          denylistTokens: ["SCAM"],
        },
      },
    });

    const pauseResponse = await fetch(`${harness.baseUrl}/control/pause`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scope: "soft",
        reason: "maintenance",
      }),
    });
    expect(pauseResponse.status).toBe(200);
    const pauseBody = await pauseResponse.json();
    expect(pauseBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        paused: true,
        pauseScope: "soft",
        pauseReason: "maintenance",
      },
    });

    const resumeResponse = await fetch(`${harness.baseUrl}/control/resume`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "maintenance complete",
      }),
    });
    expect(resumeResponse.status).toBe(200);
    const resumeBody = await resumeResponse.json();
    expect(resumeBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        paused: false,
      },
    });

    const triggerResponse = await fetch(`${harness.baseUrl}/control/kill-switch`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "trigger",
        reason: "incident",
      }),
    });
    expect(triggerResponse.status).toBe(200);
    const triggerBody = await triggerResponse.json();
    expect(triggerBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        killSwitch: true,
        paused: true,
        pauseScope: "hard",
      },
    });

    const resetResponse = await fetch(`${harness.baseUrl}/control/kill-switch`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "reset",
        reason: "incident cleared",
      }),
    });
    expect(resetResponse.status).toBe(200);
    const resetBody = await resetResponse.json();
    expect(resetBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        killSwitch: false,
        paused: true,
      },
    });

    const statusBeforeReloadResponse = await fetch(`${harness.baseUrl}/control/runtime-status`, {
      headers: controlHeaders(),
    });
    expect(statusBeforeReloadResponse.status).toBe(200);
    const statusBeforeReload = await statusBeforeReloadResponse.json();

    const reloadResponse = await fetch(`${harness.baseUrl}/control/reload`, {
      method: "POST",
      headers: {
        ...controlHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reason: "manual reload",
      }),
    });
    expect(reloadResponse.status).toBe(200);
    const reloadBody = await reloadResponse.json();
    expect(reloadBody).toMatchObject({
      success: true,
      accepted: true,
      runtimeConfig: {
        reloadNonce: statusBeforeReload.runtimeConfig.reloadNonce + 1,
      },
    });

    const historyResponse = await fetch(`${harness.baseUrl}/control/history?limit=10`, {
      headers: controlHeaders(),
    });
    expect(historyResponse.status).toBe(200);
    const historyBody = await historyResponse.json();
    expect(historyBody.history.changes.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(["runtime_config", "pause", "resume", "kill_switch", "reload"])
    );
  });
});
