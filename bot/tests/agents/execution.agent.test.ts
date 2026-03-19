/**
 * Execution agent - quote, verifyBeforeTrade, executeSwap integration.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutionHandler } from "@bot/agents/execution.agent.js";
import { createRpcClient } from "@bot/adapters/rpc-verify/client.js";
import type { TradeIntent } from "@bot/core/contracts/trade.js";

const baseIntent: TradeIntent = {
  traceId: "exec-test-trace",
  timestamp: "2026-03-05T12:00:00.000Z",
  idempotencyKey: "exec-key-1",
  tokenIn: "SOL",
  tokenOut: "USDC",
  amountIn: "1",
  minAmountOut: "0.95",
  slippagePercent: 1,
  dryRun: false,
};

describe("createExecutionHandler", () => {
  afterEach(() => {
    delete process.env.LIVE_TRADING;
    delete process.env.RPC_MODE;
  });

  it("returns paper result when no deps (default)", async () => {
    const handler = await createExecutionHandler();
    const result = await handler(baseIntent);
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.executionMode).toBe("paper");
    expect(result.paperExecution).toBe(true);
    expect(result.tradeIntentId).toBe("exec-key-1");
  });

  it("runs verifyBeforeTrade and executeSwap when deps with rpcClient and walletAddress", async () => {
    const rpcClient = createRpcClient();
    const handler = await createExecutionHandler({
      rpcClient,
      walletAddress: "11111111111111111111111111111111",
    });
    const result = await handler(baseIntent);
    expect(result.success).toBe(true);
    expect(result.executionMode).toBe("paper");
    expect(result.paperExecution).toBe(true);
  });

  it("fails when verifyBeforeTrade returns passed=false", async () => {
    const failingRpc = {
      getTokenInfo: async () => ({ mint: "x", decimals: 0, exists: false }),
      getBalance: async () => ({ address: "a", balance: "0", decimals: 9 }),
      getTransactionReceipt: async () => ({}),
    } as import("@bot/adapters/rpc-verify/client.js").RpcClient;
    const handler = await createExecutionHandler({
      rpcClient: failingRpc,
      walletAddress: "addr",
    });
    const result = await handler(baseIntent);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fails closed for live intent when signTransaction is missing", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";

    const handler = await createExecutionHandler({
      rpcClient: createRpcClient(),
      walletAddress: "11111111111111111111111111111111",
    });
    const result = await handler({
      ...baseIntent,
      executionMode: "live",
    });

    expect(result.success).toBe(false);
    expect(result.executionMode).toBe("live");
    expect(result.paperExecution).toBe(false);
    expect(result.error).toContain("requires rpcClient, walletAddress, and signTransaction");
  });

  it("runs live quote + swap with injected executors when fully wired", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";

    const quoteFetcher = vi.fn().mockResolvedValue({
      quoteId: "q-live",
      amountOut: "200",
      minAmountOut: "190",
      slippageBps: 100,
      rawQuotePayload: { routePlan: [] },
    });
    const swapExecutor = vi.fn().mockResolvedValue({
      traceId: "exec-test-trace",
      timestamp: "2026-03-05T12:00:00.000Z",
      tradeIntentId: "exec-key-1",
      success: true,
      executionMode: "live",
      dryRun: false,
      paperExecution: false,
      txSignature: "sig-live",
    });

    const handler = await createExecutionHandler({
      rpcClient: {
        sendRawTransaction: async () => "sig",
        getTokenInfo: async () => ({ mint: "mint", decimals: 9, exists: true }),
        getBalance: async () => ({ address: "a", balance: "10000000000", decimals: 9 }),
        getTransactionReceipt: async () => ({}),
      },
      walletAddress: "11111111111111111111111111111111",
      signTransaction: async (tx) => tx,
      quoteFetcher,
      swapExecutor,
    });
    const result = await handler({
      ...baseIntent,
      executionMode: "live",
    });

    expect(result.success).toBe(true);
    expect(result.executionMode).toBe("live");
    expect(result.paperExecution).toBe(false);
    expect(quoteFetcher).toHaveBeenCalledTimes(1);
    expect(swapExecutor).toHaveBeenCalledTimes(1);
  });
});
