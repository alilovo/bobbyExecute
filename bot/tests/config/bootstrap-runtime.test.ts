import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrap } from "../../src/bootstrap.js";
import { resetConfigCache } from "../../src/config/load-config.js";

const ORIG_ENV = process.env;

describe("bootstrap runtime closure (phase-1)", () => {
  beforeEach(() => {
    resetConfigCache();
    process.env = { ...ORIG_ENV };
    delete process.env.LIVE_TRADING;
    delete process.env.RPC_MODE;
  });

  afterEach(() => {
    resetConfigCache();
    process.env = ORIG_ENV;
  });

  it("starts server and dry-run runtime together", async () => {
    const { server, runtime } = await bootstrap({
      host: "127.0.0.1",
      port: 3351,
    });

    try {
      expect(runtime.getStatus()).toBe("running");
      expect(runtime.getLastState()?.blocked).toBe(true);
      expect(runtime.getLastState()?.blockedReason).toBe(
        "RUNTIME_PHASE1_FAIL_CLOSED_UNTIL_PIPELINE_WIRED"
      );

      const res = await fetch("http://127.0.0.1:3351/health");
      expect(res.status).toBe(200);
    } finally {
      await runtime.stop();
      await server.close();
    }
  });

  it("fails fast on invalid startup config", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "stub";

    await expect(
      bootstrap({
        host: "127.0.0.1",
        port: 3352,
      })
    ).rejects.toThrow(/LIVE_TRADING=true.*requires RPC_MODE=real/);
  });
});
