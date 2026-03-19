/**
 * Wave 7: Execution integration - quote, verify, swap flow.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutionHandler } from "../../src/agents/execution.agent.js";
import { createRpcClient } from "../../src/adapters/rpc-verify/client.js";
import type { TradeIntent } from "../../src/core/contracts/trade.js";

const baseIntent: TradeIntent = {
  traceId: "exec-int-trace",
  timestamp: "2026-03-06T12:00:00.000Z",
  idempotencyKey: "exec-int-key",
  tokenIn: "SOL",
  tokenOut: "USDC",
  amountIn: "1",
  minAmountOut: "0.95",
  slippagePercent: 1,
  dryRun: false,
};

const liveIntent: TradeIntent = {
  ...baseIntent,
  traceId: "exec-live-trace",
  idempotencyKey: "exec-live-key",
  executionMode: "live",
};

describe("Execution integration (Wave 7)", () => {
  afterEach(() => {
    delete process.env.LIVE_TRADING;
    delete process.env.RPC_MODE;
  });

  it("handler with RPC client runs verify + swap path", async () => {
    const rpcClient = createRpcClient();
    const handler = await createExecutionHandler({
      rpcClient,
      walletAddress: "11111111111111111111111111111111",
    });
    const result = await handler(baseIntent);
    expect(result.success).toBe(true);
    expect(result.tradeIntentId).toBe(baseIntent.idempotencyKey);
  });

  it("verify failure blocks execution and returns success=false", async () => {
    const failingRpc = {
      getTokenInfo: async () => ({ mint: "x", decimals: 0, exists: false }),
      getBalance: async () => ({ address: "a", balance: "0", decimals: 9 }),
      getTransactionReceipt: async () => ({}),
    } as import("../../src/adapters/rpc-verify/client.js").RpcClient;

    const handler = await createExecutionHandler({
      rpcClient: failingRpc,
      walletAddress: "addr",
    });
    const result = await handler(baseIntent);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("paper mode returns dryRun=true without SwapDeps", async () => {
    const handler = await createExecutionHandler();
    const result = await handler({ ...baseIntent, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("live intent does not degrade into synthetic dry success when live trading is disabled", async () => {
    delete process.env.LIVE_TRADING;

    const handler = await createExecutionHandler();
    const result = await handler(liveIntent);

    expect(result.success).toBe(false);
    expect(result.executionMode).toBe("live");
    expect(result.dryRun).toBe(false);
    expect(result.paperExecution).toBe(false);
    expect(result.error).toContain("Live execution disabled");
  });

  it("live intent fails closed when live swap dependencies are incomplete", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";

    const rpcClient = createRpcClient();
    const handler = await createExecutionHandler({
      rpcClient,
      walletAddress: "11111111111111111111111111111111",
    });

    const result = await handler(liveIntent);
    expect(result.success).toBe(false);
    expect(result.executionMode).toBe("live");
    expect(result.paperExecution).toBe(false);
    expect(result.error).toContain("requires rpcClient, walletAddress, and signTransaction");

  });

  it("live intent uses quote + swap boundary when fully wired", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";

    const quoteFetcher = vi.fn().mockResolvedValue({
      quoteId: "q-live",
      amountOut: "123",
      minAmountOut: "120",
      slippageBps: 100,
      rawQuotePayload: { routePlan: [] },
    });
    const swapExecutor = vi.fn().mockResolvedValue({
      traceId: liveIntent.traceId,
      timestamp: liveIntent.timestamp,
      tradeIntentId: liveIntent.idempotencyKey,
      success: true,
      executionMode: "live",
      dryRun: false,
      paperExecution: false,
      txSignature: "live-sig-1",
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

    const result = await handler(liveIntent);
    expect(result.success).toBe(true);
    expect(result.executionMode).toBe("live");
    expect(result.paperExecution).toBe(false);
    expect(quoteFetcher).toHaveBeenCalledWith(liveIntent);
    expect(swapExecutor).toHaveBeenCalledTimes(1);
    expect(swapExecutor.mock.calls[0][0]).toEqual(liveIntent);
    expect(swapExecutor.mock.calls[0][1]).toMatchObject({ quoteId: "q-live" });
    expect(swapExecutor.mock.calls[0][2]).toMatchObject({
      walletPublicKey: "11111111111111111111111111111111",
    });
  });
});
