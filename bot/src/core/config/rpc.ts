/**
 * M4: RPC configuration - RPC_URL, RPC_MODE.
 */
export type RpcMode = "stub" | "real";

export function getRpcMode(): RpcMode {
  const m = process.env.RPC_MODE?.toLowerCase();
  if (m === "real") return "real";
  return "stub";
}

export function getRpcUrl(): string {
  return process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com";
}
