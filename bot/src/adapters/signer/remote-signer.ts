import { resilientFetch } from "../http-resilience.js";
import type { Config } from "../../config/config-schema.js";
import {
  SignerError,
  SignerRequest,
  SignerRequestSchema,
  SignerResponse,
  SignerResponseSchema,
  type Signer,
  type SignerConfigShape,
  validateSignerResponseMatchesRequest,
} from "./types.js";

const DEFAULT_SIGNER_TIMEOUT_MS = 10_000;

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return "<invalid-signer-url>";
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /timeout/i.test(error.message))
  );
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function safeResponseBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

export class DisabledSigner implements Signer {
  readonly mode = "disabled" as const;

  async sign(): Promise<never> {
    throw new SignerError(
      "SIGNER_DISABLED",
      "Signing is disabled. Configure SIGNER_MODE=remote for live trading."
    );
  }
}

export class RemoteSignerClient implements Signer {
  readonly mode = "remote" as const;
  readonly keyId?: string;

  private readonly signerUrl: string;
  private readonly authToken: string;
  private readonly timeoutMs: number;

  constructor(config: SignerConfigShape) {
    if (config.signerMode !== "remote") {
      throw new SignerError(
        "SIGNER_DISABLED",
        "RemoteSignerClient requires SIGNER_MODE=remote."
      );
    }

    if (!config.signerUrl || !config.signerAuthToken) {
      throw new SignerError(
        "SIGNER_REQUEST_INVALID",
        "RemoteSignerClient requires SIGNER_URL and SIGNER_AUTH_TOKEN."
      );
    }

    this.signerUrl = config.signerUrl;
    this.authToken = config.signerAuthToken;
    this.keyId = config.signerKeyId;
    this.timeoutMs = config.signerTimeoutMs ?? DEFAULT_SIGNER_TIMEOUT_MS;
  }

  async sign(request: SignerRequest): Promise<SignerResponse> {
    const parsedRequest = SignerRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new SignerError(
        "SIGNER_REQUEST_INVALID",
        `Remote signer request failed validation: ${parsedRequest.error.message}`,
        parsedRequest.error
      );
    }
    const normalizedRequest = parsedRequest.data;

    let response: Response;
    try {
      response = await resilientFetch(
        this.signerUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.authToken}`,
          },
          body: JSON.stringify(normalizedRequest),
        },
        {
          timeoutMs: this.timeoutMs,
          maxRetries: 0,
          adapterId: "remote-signer",
        }
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw new SignerError(
          "SIGNER_TIMEOUT",
          `Remote signer timed out after ${this.timeoutMs}ms.`,
          error
        );
      }

      throw new SignerError(
        "SIGNER_UNAVAILABLE",
        `Remote signer request failed: ${safeErrorMessage(error)}`,
        error
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new SignerError(
        "SIGNER_AUTH_FAILED",
        `Remote signer rejected authorization (${response.status}).`,
        undefined,
        response.status
      );
    }

    if (!response.ok) {
      const body = await safeResponseBody(response);
      throw new SignerError(
        "SIGNER_UNAVAILABLE",
        `Remote signer returned HTTP ${response.status}${body ? `: ${body}` : ""}.`,
        undefined,
        response.status
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      throw new SignerError(
        "SIGNER_BAD_RESPONSE",
        "Remote signer returned a non-JSON response body.",
        error,
        response.status
      );
    }

    const parsed = SignerResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SignerError(
        "SIGNER_BAD_RESPONSE",
        `Remote signer response failed validation: ${parsed.error.message}`,
        parsed.error,
        response.status
      );
    }

    validateSignerResponseMatchesRequest(normalizedRequest, parsed.data);
    return parsed.data;
  }
}

export function createSignerFromConfig(config: Config): Signer {
  if (config.signerMode === "remote") {
    return new RemoteSignerClient(config);
  }

  return new DisabledSigner();
}

export function redactSignerUrlForLogs(url: string): string {
  return redactUrl(url);
}
