/**
 * Jupiter Quote API - unit tests with mocked fetch.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getQuote } from "@bot/adapters/dex-execution/quotes.js";
import type { TradeIntent } from "@bot/core/contracts/trade.js";

describe("getQuote", () => {
  const originalJupiterQuoteUrl = process.env.JUPITER_QUOTE_URL;
  const originalJupiterApiKey = process.env.JUPITER_API_KEY;

  const baseIntent: TradeIntent = {
    traceId: "test-trace",
    timestamp: "2025-03-01T12:00:00.000Z",
    idempotencyKey: "test-key",
    tokenIn: "SOL",
    tokenOut: "USDC",
    amountIn: "1000000000",
    minAmountOut: "0",
    slippagePercent: 1,
    dryRun: false,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.JUPITER_QUOTE_URL = "";
    process.env.JUPITER_API_KEY = "test-jupiter-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalJupiterQuoteUrl === undefined) {
      delete process.env.JUPITER_QUOTE_URL;
    } else {
      process.env.JUPITER_QUOTE_URL = originalJupiterQuoteUrl;
    }
    if (originalJupiterApiKey === undefined) {
      delete process.env.JUPITER_API_KEY;
    } else {
      process.env.JUPITER_API_KEY = originalJupiterApiKey;
    }
  });

  it("returns QuoteResult with amountOut, minAmountOut, rawQuotePayload from Jupiter response", async () => {
    const jupiterResponse = {
      inputMint: "So11111111111111111111111111111111111111112",
      inAmount: "1000000000",
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      outAmount: "170574600",
      otherAmountThreshold: "168868854",
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => jupiterResponse,
    });

    const result = await getQuote(baseIntent);

    expect(result.quoteId).toBe("test-key");
    expect(result.amountOut).toBe("170574600");
    expect(result.minAmountOut).toBe("168868854");
    expect(result.slippageBps).toBe(100);
    expect(result.rawQuotePayload).toEqual(jupiterResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callUrl).toContain("api.jup.ag");
    expect(callUrl).toContain("inputMint=");
    expect(callUrl).toContain("amount=1000000000");
    const callInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(callInit.headers).toEqual(expect.objectContaining({ "x-api-key": "test-jupiter-key" }));
  });

  it("converts human amount (1 SOL) to raw for Jupiter", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        outAmount: "95000000",
        otherAmountThreshold: "94050000",
      }),
    });

    await getQuote({ ...baseIntent, amountIn: "1", tokenIn: "SOL" });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callUrl).toContain("amount=1000000000");
  });

  it("throws when Jupiter returns non-ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Invalid input mint",
    });

    await expect(getQuote(baseIntent)).rejects.toThrow(/Jupiter quote failed \(400\)/);
  });

  it("fails clearly when JUPITER_API_KEY is missing", async () => {
    delete process.env.JUPITER_API_KEY;

    await expect(getQuote(baseIntent)).rejects.toThrow(/JUPITER_API_KEY|Jupiter API key/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
