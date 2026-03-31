import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RemoteSignerClient, DisabledSigner, SignerError } from "@bot/adapters/signer/index.js";
import type { SignerRequest } from "@bot/adapters/signer/index.js";

function makeRequest(): SignerRequest {
  return {
    purpose: "live_swap",
    walletAddress: "11111111111111111111111111111111",
    keyId: "remote-key-1",
    transactions: [
      {
        id: "swap-transaction",
        kind: "transaction",
        encoding: "base64",
        payload: "c2lnbmVkLXR4LXBheWxvYWQ=",
      },
    ],
  };
}

function makeFetchResponse(input: {
  ok: boolean;
  status: number;
  json?: unknown;
  text?: string;
}): Response {
  return {
    ok: input.ok,
    status: input.status,
    statusText: input.status >= 400 ? "error" : "ok",
    json: async () => input.json,
    text: async () => input.text ?? JSON.stringify(input.json ?? {}),
  } as Response;
}

describe("remote signer client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws closed when disabled signer is used", async () => {
    const signer = new DisabledSigner();
    await expect(signer.sign(makeRequest())).rejects.toMatchObject({
      code: "SIGNER_DISABLED",
    });
  });

  it("signs a request over bearer-authenticated remote transport", async () => {
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchFn.mockResolvedValueOnce(
      makeFetchResponse({
        ok: true,
        status: 200,
        json: {
          walletAddress: "11111111111111111111111111111111",
          keyId: "remote-key-1",
          signedTransactions: [
            {
              id: "swap-transaction",
              kind: "transaction",
              encoding: "base64",
              signedPayload: "c2lnbmVkLXR4LXBheWxvYWQ=",
            },
          ],
        },
      })
    );

    const signer = new RemoteSignerClient({
      signerMode: "remote",
      signerUrl: "https://signer.example.com/sign",
      signerAuthToken: "super-secret-token",
      signerKeyId: "remote-key-1",
      signerTimeoutMs: 1000,
    });

    const result = await signer.sign(makeRequest());
    expect(result.walletAddress).toBe("11111111111111111111111111111111");
    expect(result.signedTransactions[0]?.signedPayload).toBe("c2lnbmVkLXR4LXBheWxvYWQ=");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://signer.example.com/sign");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer super-secret-token",
        "Content-Type": "application/json",
      })
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      walletAddress: "11111111111111111111111111111111",
      keyId: "remote-key-1",
      transactions: [{ id: "swap-transaction" }],
    });
  });

  it("fails closed on remote signer timeout", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          if (signal?.aborted) {
            reject(abortError);
            return;
          }
          signal?.addEventListener(
            "abort",
            () => {
              reject(abortError);
            },
            { once: true }
          );
        })
      )
    );

    const signer = new RemoteSignerClient({
      signerMode: "remote",
      signerUrl: "https://signer.example.com/sign",
      signerAuthToken: "super-secret-token",
      signerTimeoutMs: 5,
    });

    await expect(signer.sign(makeRequest())).rejects.toMatchObject({
      code: "SIGNER_TIMEOUT",
    });
  });

  it("fails closed on malformed remote signer responses", async () => {
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchFn.mockResolvedValueOnce(
      makeFetchResponse({
        ok: true,
        status: 200,
        json: {
          walletAddress: "11111111111111111111111111111111",
          signedTransactions: [
            {
              id: "swap-transaction",
              kind: "transaction",
              encoding: "base64",
            },
          ],
        },
      })
    );

    const signer = new RemoteSignerClient({
      signerMode: "remote",
      signerUrl: "https://signer.example.com/sign",
      signerAuthToken: "super-secret-token",
      signerTimeoutMs: 1000,
    });

    await expect(signer.sign(makeRequest())).rejects.toMatchObject({
      code: "SIGNER_BAD_RESPONSE",
    });
  });

  it("fails closed when the signer returns the wrong wallet address", async () => {
    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchFn.mockResolvedValueOnce(
      makeFetchResponse({
        ok: true,
        status: 200,
        json: {
          walletAddress: "22222222222222222222222222222222",
          signedTransactions: [
            {
              id: "swap-transaction",
              kind: "transaction",
              encoding: "base64",
              signedPayload: "c2lnbmVkLXR4LXBheWxvYWQ=",
            },
          ],
        },
      })
    );

    const signer = new RemoteSignerClient({
      signerMode: "remote",
      signerUrl: "https://signer.example.com/sign",
      signerAuthToken: "super-secret-token",
      signerTimeoutMs: 1000,
    });

    await expect(signer.sign(makeRequest())).rejects.toMatchObject({
      code: "SIGNER_WALLET_MISMATCH",
    });
  });
});
