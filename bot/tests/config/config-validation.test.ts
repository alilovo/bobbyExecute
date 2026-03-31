/**
 * Config validation tests - Normalized planning package P1.
 * Fail-closed: invalid config combinations reject startup.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { parseConfig } from "../../src/config/config-schema.js";
import { loadConfig, resetConfigCache } from "../../src/config/load-config.js";

describe("Config validation (P1)", () => {
  const orig = process.env;

  beforeEach(() => {
    resetConfigCache();
    process.env = { ...orig };
  });

  afterEach(() => {
    process.env = orig;
  });

  it("config invalid combo rejects startup: LIVE_TRADING=true with RPC_MODE=stub", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "stub";

    expect(() => parseConfig(process.env as Record<string, string | undefined>)).toThrow(
      /LIVE_TRADING=true.*requires RPC_MODE=real/
    );
  });

  it("loadConfig throws on invalid combo", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "stub";

    expect(() => loadConfig(process.env as Record<string, string | undefined>)).toThrow(
      /LIVE_TRADING=true.*requires RPC_MODE=real/
    );
  });

  it("valid combo LIVE_TRADING=true with RPC_MODE=real parses", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.RPC_URL = "https://api.mainnet-beta.solana.com";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.SIGNER_MODE = "remote";
    process.env.SIGNER_URL = "https://signer.example.com/sign";
    process.env.SIGNER_AUTH_TOKEN = "phase10-signer-auth-token";
    process.env.SIGNER_KEY_ID = "remote-key-1";
    process.env.SIGNER_TIMEOUT_MS = "15000";
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";

    const config = parseConfig(process.env as Record<string, string | undefined>);
    expect(config.executionMode).toBe("live");
    expect(config.rpcMode).toBe("real");
    expect(config.tradingEnabled).toBe(true);
    expect(config.liveTestMode).toBe(true);
    expect(config.signerMode).toBe("remote");
    expect(config.signerUrl).toBe("https://signer.example.com/sign");
    expect(config.signerKeyId).toBe("remote-key-1");
    expect(config.controlToken).toBe("phase10-live-control-token");
    expect(config.operatorReadToken).toBe("phase10-live-operator-token");
  });

  it("live config rejects missing explicit pre-live prerequisites", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";
    delete process.env.TRADING_ENABLED;
    delete process.env.LIVE_TEST_MODE;
    delete process.env.WALLET_ADDRESS;
    delete process.env.SIGNER_MODE;
    delete process.env.SIGNER_URL;
    delete process.env.SIGNER_AUTH_TOKEN;
    delete process.env.CONTROL_TOKEN;
    delete process.env.OPERATOR_READ_TOKEN;

    expect(() => parseConfig(process.env as Record<string, string | undefined>)).toThrow(
      /TRADING_ENABLED=true|LIVE_TEST_MODE=true|WALLET_ADDRESS|SIGNER_MODE|CONTROL_TOKEN|OPERATOR_READ_TOKEN/
    );
  });

  it("live config rejects disabled signer mode", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.SIGNER_MODE = "disabled";
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";

    expect(() => parseConfig(process.env as Record<string, string | undefined>)).toThrow(
      /SIGNER_MODE=remote/
    );
  });

  it("loadConfig rejects live mode without remote signer config", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    delete process.env.SIGNER_MODE;
    delete process.env.SIGNER_URL;
    delete process.env.SIGNER_AUTH_TOKEN;
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";

    expect(() => loadConfig(process.env as Record<string, string | undefined>)).toThrow(
      /SIGNER_MODE=remote/
    );
  });

  it("loadConfig rejects invalid live-test caps in live mode", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.LIVE_TEST_MAX_CAPITAL_USD = "0";
    process.env.LIVE_TEST_MAX_TRADES_PER_DAY = "1";
    process.env.LIVE_TEST_MAX_DAILY_LOSS_USD = "50";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.SIGNER_MODE = "remote";
    process.env.SIGNER_URL = "https://signer.example.com/sign";
    process.env.SIGNER_AUTH_TOKEN = "phase10-signer-auth-token";
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";

    expect(() => loadConfig(process.env as Record<string, string | undefined>)).toThrow(
      /LIVE_TEST_MAX_CAPITAL_USD must be at least 1/
    );
  });

  it("live config rejects identical control and operator read tokens", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.RPC_URL = "https://api.mainnet-beta.solana.com";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.CONTROL_TOKEN = "phase10-shared-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-shared-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";

    expect(() => parseConfig(process.env as Record<string, string | undefined>)).toThrow(
      /CONTROL_TOKEN and OPERATOR_READ_TOKEN to be distinct/
    );
  });

  it("loadConfig rejects live mode without MORALIS_API_KEY", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.SIGNER_MODE = "remote";
    process.env.SIGNER_URL = "https://signer.example.com/sign";
    process.env.SIGNER_AUTH_TOKEN = "phase10-signer-auth-token";
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.JUPITER_API_KEY = "phase10-jupiter-api-key";
    delete process.env.MORALIS_API_KEY;

    expect(() => loadConfig(process.env as Record<string, string | undefined>)).toThrow(/MORALIS_API_KEY/);
  });

  it("loadConfig rejects live mode without JUPITER_API_KEY", () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.TRADING_ENABLED = "true";
    process.env.LIVE_TEST_MODE = "true";
    process.env.WALLET_ADDRESS = "11111111111111111111111111111111";
    process.env.SIGNER_MODE = "remote";
    process.env.SIGNER_URL = "https://signer.example.com/sign";
    process.env.SIGNER_AUTH_TOKEN = "phase10-signer-auth-token";
    process.env.CONTROL_TOKEN = "phase10-live-control-token";
    process.env.OPERATOR_READ_TOKEN = "phase10-live-operator-token";
    process.env.MORALIS_API_KEY = "phase10-moralis-api-key";
    delete process.env.JUPITER_API_KEY;

    expect(() => loadConfig(process.env as Record<string, string | undefined>)).toThrow(/JUPITER_API_KEY/);
  });

  it("loadConfig allows paper mode without Moralis or Jupiter keys", () => {
    process.env.LIVE_TRADING = "false";
    process.env.DRY_RUN = "false";
    process.env.RPC_MODE = "real";
    delete process.env.MORALIS_API_KEY;
    delete process.env.JUPITER_API_KEY;

    const config = loadConfig(process.env as Record<string, string | undefined>);
    expect(config.executionMode).toBe("paper");
    expect(config.rpcMode).toBe("real");
  });

  it("default config has executionMode dry and rpcMode stub", () => {
    delete process.env.LIVE_TRADING;
    delete process.env.RPC_MODE;

    const config = parseConfig(process.env as Record<string, string | undefined>);
    expect(config.executionMode).toBe("dry");
    expect(config.rpcMode).toBe("stub");
    expect(config.signerMode).toBe("disabled");
  });
});
