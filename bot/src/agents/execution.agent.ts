/**
 * Execution agent - executes swap via DEX adapter.
 * Wires getQuote, optional RPC verification, executeSwap.
 */
import type { VersionedTransaction } from "@solana/web3.js";
import type { TradeIntent } from "../core/contracts/trade.js";
import type { ExecutionReport } from "../core/contracts/trade.js";
import type { RpcClient } from "../adapters/rpc-verify/client.js";
import { getQuote } from "../adapters/dex-execution/quotes.js";
import type { QuoteResult } from "../adapters/dex-execution/types.js";
import { executeSwap, type SwapDeps } from "../adapters/dex-execution/swap.js";
import { verifyBeforeTrade } from "../adapters/rpc-verify/verify.js";
import { isLiveTradingEnabled } from "../config/safety.js";

export interface ExecutionHandlerDeps {
  rpcClient?: RpcClient;
  walletAddress?: string;
  signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  quoteFetcher?: (intent: TradeIntent) => Promise<QuoteResult>;
  swapExecutor?: (intent: TradeIntent, quote?: QuoteResult, deps?: SwapDeps) => Promise<ExecutionReport>;
}

/**
 * Creates execution handler. When deps provided with rpcClient and walletAddress:
 * - Runs verifyBeforeTrade before swap (fail-closed if passed=false).
 * - Fetches quote, passes to executeSwap.
 * - For live mode, SwapDeps derived from deps.
 */
export async function createExecutionHandler(
  deps?: ExecutionHandlerDeps
): Promise<(intent: TradeIntent) => Promise<ExecutionReport>> {
  const quoteFetcher = deps?.quoteFetcher ?? getQuote;
  const swapExecutor = deps?.swapExecutor ?? executeSwap;

  return async (intent) => {
    const rpcClient = deps?.rpcClient;
    const walletAddress = deps?.walletAddress;
    const signTransaction = deps?.signTransaction;
    const sendRawTransaction = rpcClient?.sendRawTransaction;

    const liveIntent = intent.executionMode === "live";
    const hasVerifyDeps = !!(rpcClient && walletAddress);
    const hasLiveSwapDeps = !!(sendRawTransaction && walletAddress && signTransaction);
    const hasAnyLiveDeps = !!(rpcClient || walletAddress || signTransaction);

    if (liveIntent && hasAnyLiveDeps && !hasLiveSwapDeps) {
      return {
        traceId: intent.traceId,
        timestamp: intent.timestamp,
        tradeIntentId: intent.idempotencyKey,
        success: false,
        error: "Live execution requires rpcClient, walletAddress, and signTransaction.",
        dryRun: false,
        executionMode: "live",
        paperExecution: false,
      };
    }

    if (hasVerifyDeps) {
      const verify = await verifyBeforeTrade(
        rpcClient!,
        intent,
        walletAddress!,
        intent.traceId,
        intent.timestamp
      );
      if (!verify.passed) {
        const executionMode = intent.executionMode ?? (intent.dryRun ? "dry" : "paper");
        return {
          traceId: intent.traceId,
          timestamp: intent.timestamp,
          tradeIntentId: intent.idempotencyKey,
          success: false,
          error: verify.reason ?? "Pre-trade verification failed",
          dryRun: executionMode === "dry",
          executionMode,
          paperExecution: executionMode === "paper",
        };
      }
    }

    if (liveIntent && !isLiveTradingEnabled()) {
      return swapExecutor(intent, undefined, undefined);
    }

    const swapDeps: SwapDeps | undefined = hasLiveSwapDeps
      ? {
          rpcClient: { sendRawTransaction: sendRawTransaction! },
          walletPublicKey: walletAddress!,
          signTransaction: signTransaction!,
        }
      : undefined;

    const quote = liveIntent ? await quoteFetcher(intent) : undefined;
    return swapExecutor(intent, quote, swapDeps);
  };
}
