/**
 * Safety Switch - Production Readiness M0.
 * Global config flag: LIVE_TRADING must be explicitly enabled for real swap execution.
 * Default: false (paper mode).
 */
const LIVE_TRADING_ENV = "LIVE_TRADING";

/**
 * Returns true only when LIVE_TRADING is explicitly set to "true" (case-insensitive).
 * Default: false — paper/dry-run mode.
 */
export function isLiveTradingEnabled(): boolean {
  const val = process.env[LIVE_TRADING_ENV];
  if (val == null || val === "") return false;
  return String(val).toLowerCase() === "true";
}
