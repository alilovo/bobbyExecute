/**
 * M4: Solana RPC client via @solana/web3.js.
 * Real onchain verification for verifyBeforeTrade/verifyAfterTrade.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import type { RpcClient, RpcClientConfig, TokenInfo, BalanceResult } from "./client.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/** SPL Mint layout: decimals at byte 44. */
function parseMintDecimals(data: Buffer): number {
  if (data.length < 45) return 0;
  return data.readUInt8(44);
}

export class SolanaWeb3RpcClient implements RpcClient {
  private connection: Connection;
  private readonly config: RpcClientConfig;

  constructor(config: RpcClientConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl);
  }

  private async withFailover<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    try {
      return await fn(this.connection);
    } catch (err) {
      if (this.config.rpcUrlSecondary) {
        const secondaryConn = new Connection(this.config.rpcUrlSecondary);
        return await fn(secondaryConn);
      }
      throw err;
    }
  }

  async getTokenInfo(mint: string): Promise<TokenInfo> {
    try {
      return await this.withFailover(async (conn) => {
        const pk = new PublicKey(mint);
        const info = await conn.getAccountInfo(pk);
        if (!info?.data) {
          return { mint, decimals: 0, exists: false };
        }
        const decimals = parseMintDecimals(Buffer.from(info.data));
        return { mint, decimals, exists: true };
      });
    } catch {
      return { mint, decimals: 0, exists: false };
    }
  }

  async getBalance(address: string, mint?: string): Promise<BalanceResult> {
    try {
      return await this.withFailover(async (conn) => {
        const ownerPk = new PublicKey(address);

        const isNativeSol = !mint || mint === "SOL" || mint === "So11111111111111111111111111111111111111112";
        if (isNativeSol) {
          const lamports = await conn.getBalance(ownerPk);
          return {
            address,
            balance: lamports.toString(),
            decimals: 9,
          };
        }

        const mintPk = new PublicKey(mint!);
        const accounts = await conn.getParsedTokenAccountsByOwner(ownerPk, {
          mint: mintPk,
        });

        if (accounts.value.length === 0) {
          const tokenInfo = await this.getTokenInfo(mint!);
          return {
            address,
            balance: "0",
            decimals: tokenInfo.decimals,
          };
        }

        const parsed = accounts.value[0].account.data.parsed.info;
        const amount = parsed.tokenAmount?.amount ?? "0";
        const decimals = parsed.tokenAmount?.decimals ?? 9;

        return {
          address,
          balance: amount,
          decimals,
        };
      });
    } catch (err) {
      throw new Error(`RPC getBalance failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async getTransactionReceipt(signature: string): Promise<unknown> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      return status?.value
        ? { status: status.value.confirmationStatus ?? "confirmed", slot: status.value.slot }
        : { status: "unknown", slot: null };
    } catch (err) {
      throw new Error(
        `RPC getTransactionReceipt failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async sendRawTransaction(tx: Uint8Array | Buffer): Promise<string> {
    try {
      const buf = Buffer.isBuffer(tx) ? tx : Buffer.from(tx);
      return await this.connection.sendRawTransaction(buf, { skipPreflight: false });
    } catch (err) {
      throw new Error(
        `RPC sendRawTransaction failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
