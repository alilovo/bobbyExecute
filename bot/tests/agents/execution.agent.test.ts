/**
 * Execution agent - live boundary and fail-closed behavior.
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

  it("keeps paper behavior unchanged for non-live intents", async () => {
    const handler = await createExecutionHandler();
    const result = await handler(baseIntent);
    expect(result.success).toBe(true);
    expect(result.executionMode).toBe("paper");
    expect(result.paperExecution).toBe(true);
  });

  it("runs verifyBeforeTrade and executeSwap when verify deps are present", async () => {
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
    expect(result.failureCode).toBe("live_dependency_incomplete");
    expect(result.failClosed).toBe(true);
  });

  it("rejects synthetic live success that lacks verification evidence", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";

    const quoteFetcher = vi.fn().mockResolvedValue({
      quoteId: "q-live",
      amountOut: "200",
      minAmountOut: "190",
      fetchedAt: new Date().toISOString(),
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
      artifacts: {},
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

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe("live_verification_failed");
    expect(result.failClosed).toBe(true);
    expect(quoteFetcher).toHaveBeenCalledTimes(1);
    expect(swapExecutor).toHaveBeenCalledTimes(1);
  });
});
