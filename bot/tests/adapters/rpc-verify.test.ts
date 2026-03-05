/**
 * M4: RPC client and verify - mocked Connection, fail-closed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRpcClient, StubRpcClient } from "@bot/adapters/rpc-verify/client.js";
import { verifyBeforeTrade, verifyAfterTrade } from "@bot/adapters/rpc-verify/verify.js";
import type { TradeIntent, ExecutionReport } from "@bot/core/contracts/trade.js";

const baseIntent: TradeIntent = {
  traceId: "trace-1",
  timestamp: "2026-03-05T12:00:00.000Z",
  idempotencyKey: "key-1",
  tokenIn: "SOL",
  tokenOut: "USDC",
  amountIn: "1",
  minAmountOut: "0.95",
  slippagePercent: 1,
  dryRun: false,
};

describe("RPC client factory", () => {
  const origRpcMode = process.env.RPC_MODE;

  afterEach(() => {
    if (origRpcMode !== undefined) process.env.RPC_MODE = origRpcMode;
    else delete process.env.RPC_MODE;
  });

  it("returns StubRpcClient when RPC_MODE=stub", () => {
    process.env.RPC_MODE = "stub";
    const client = createRpcClient({ rpcUrl: "https://test" });
    expect(client).toBeInstanceOf(StubRpcClient);
  });

  it("returns SolanaWeb3RpcClient when RPC_MODE=real", () => {
    process.env.RPC_MODE = "real";
    const client = createRpcClient({ rpcUrl: "https://api.mainnet-beta.solana.com" });
    expect(client.constructor.name).toBe("SolanaWeb3RpcClient");
  });
});

describe("verifyBeforeTrade", () => {
  it("passes with stub client and sufficient balance", async () => {
    const client = new StubRpcClient({ rpcUrl: "https://test" });
    const report = await verifyBeforeTrade(client, baseIntent, "addr1", "trace-1", baseIntent.timestamp);
    expect(report.passed).toBe(true);
    expect(report.checks.tokenMint).toBe(true);
  });

  it("fail-closed on RPC error", async () => {
    const client = new StubRpcClient({ rpcUrl: "https://test" });
    vi.spyOn(client, "getTokenInfo").mockRejectedValueOnce(new Error("RPC unavailable"));
    const report = await verifyBeforeTrade(client, baseIntent, "addr1", "trace-1", baseIntent.timestamp);
    expect(report.passed).toBe(false);
    expect(report.reason).toContain("RPC");
  });
});

describe("verifyAfterTrade", () => {
  it("passes when receipt exists", async () => {
    const client = new StubRpcClient({ rpcUrl: "https://test" });
    const report: ExecutionReport = {
      traceId: "trace-1",
      timestamp: baseIntent.timestamp,
      tradeIntentId: baseIntent.idempotencyKey,
      success: true,
      actualAmountOut: "0.96",
      dryRun: false,
      txSignature: "sig123",
    };
    const result = await verifyAfterTrade(client, baseIntent, report, "trace-1", baseIntent.timestamp);
    expect(result.passed).toBe(true);
  });

  it("fail-closed on getTransactionReceipt error", async () => {
    const client = new StubRpcClient({ rpcUrl: "https://test" });
    vi.spyOn(client, "getTransactionReceipt").mockRejectedValueOnce(new Error("RPC timeout"));
    const report: ExecutionReport = {
      traceId: "trace-1",
      timestamp: baseIntent.timestamp,
      tradeIntentId: baseIntent.idempotencyKey,
      success: true,
      actualAmountOut: "0.96",
      dryRun: false,
      txSignature: "sig123",
    };
    const result = await verifyAfterTrade(client, baseIntent, report, "trace-1", baseIntent.timestamp);
    expect(result.passed).toBe(false);
  });
});
