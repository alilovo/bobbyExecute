/**
 * DexPaprika API client.
 * PROPOSED - DEX layer for pricing, pools, liquidity.
 */
import { sha256 } from "../../core/determinism/hash.js";
import {
  resilientFetch,
  type ResilientFetchOptions,
} from "../http-resilience.js";

const BASE_URL = "https://api.dexpaprika.com";

export interface DexPaprikaClientConfig {
  baseUrl?: string;
  network?: string;
  resilience?: ResilientFetchOptions;
}

export class DexPaprikaClient {
  private readonly baseUrl: string;
  private readonly network: string;
  private readonly resilience: ResilientFetchOptions | undefined;

  constructor(config: DexPaprikaClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.network = config.network ?? "solana";
    this.resilience = config.resilience;
  }

  private async _fetch(url: string): Promise<Response> {
    return resilientFetch(url, undefined, {
      ...this.resilience,
      adapterId: this.resilience?.adapterId ?? "dexpaprika",
    });
  }

  async getToken(tokenId: string): Promise<unknown> {
    const url = `${this.baseUrl}/networks/${this.network}/tokens/${tokenId}`;
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`DexPaprika error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getTokenPools(tokenId: string): Promise<unknown> {
    const url = `${this.baseUrl}/networks/${this.network}/tokens/${tokenId}/pools`;
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`DexPaprika error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getPools(limit = 10): Promise<unknown> {
    const url = `${this.baseUrl}/networks/${this.network}/pools?limit=${limit}`;
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`DexPaprika error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  /** Returns raw response + hash for audit. */
  async getTokenWithHash(tokenId: string): Promise<{
    raw: unknown;
    rawPayloadHash: string;
  }> {
    const raw = await this.getToken(tokenId);
    const rawPayloadHash = sha256(JSON.stringify(raw));
    return { raw, rawPayloadHash };
  }
}
