/**
 * Swap execution - executes trade via DEX.
 * PROPOSED - integrates with Jupiter, Raydium, etc. for Solana.
 * M0: LIVE_TRADING must be explicitly enabled; default is paper mode.
 */
import type { TradeIntent } from "../../core/contracts/trade.js";
import type { ExecutionReport } from "../../core/contracts/trade.js";
import { isLiveTradingEnabled, assertLiveTradingRequiresRealRpc } from "../../config/safety.js";

/**
 * Stub swap execution for paper-trade.
 * Production would sign and submit tx via DEX SDK.
 *
 * M0 Safety: Real swap is blocked unless:
 * - LIVE_TRADING=true (env) AND
 * - intent.dryRun=false AND
 * - (future) real implementation exists
 * Default: always paper.
 */
export async function executeSwap(intent: TradeIntent): Promise<ExecutionReport> {
  const liveAllowed = isLiveTradingEnabled();

  if (!liveAllowed || intent.dryRun) {
    return {
      traceId: intent.traceId,
      timestamp: intent.timestamp,
      tradeIntentId: intent.idempotencyKey,
      success: true,
      actualAmountOut: intent.minAmountOut,
      dryRun: true,
    };
  }

  assertLiveTradingRequiresRealRpc();

  // LIVE_TRADING=true but real swap not implemented
  throw new Error(
    "Real swap execution not implemented - set LIVE_TRADING=false or dryRun: true for paper-trade"
  );
}
