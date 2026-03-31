import { z } from "zod";

export const SignerModeSchema = z.enum(["disabled", "remote"]);
export type SignerMode = z.infer<typeof SignerModeSchema>;

export const SignerPurposeSchema = z.enum(["live_swap", "generic"]);
export type SignerPurpose = z.infer<typeof SignerPurposeSchema>;

export const SignerPayloadKindSchema = z.enum(["transaction", "message"]);
export type SignerPayloadKind = z.infer<typeof SignerPayloadKindSchema>;

export const SignerEncodingSchema = z.literal("base64");
export type SignerEncoding = z.infer<typeof SignerEncodingSchema>;

export const SignerRequestItemSchema = z
  .object({
    id: z.string().min(1),
    kind: SignerPayloadKindSchema,
    encoding: SignerEncodingSchema,
    payload: z.string().min(1),
  })
  .strict();

export type SignerRequestItem = z.infer<typeof SignerRequestItemSchema>;

export const SignerResponseItemSchema = z
  .object({
    id: z.string().min(1),
    kind: SignerPayloadKindSchema,
    encoding: SignerEncodingSchema,
    signedPayload: z.string().min(1),
  })
  .strict();

export type SignerResponseItem = z.infer<typeof SignerResponseItemSchema>;

export const SignerRequestSchema = z
  .object({
    purpose: SignerPurposeSchema,
    walletAddress: z.string().min(32),
    keyId: z.string().min(1).optional(),
    transactions: z.array(SignerRequestItemSchema).min(1),
  })
  .strict();

export type SignerRequest = z.infer<typeof SignerRequestSchema>;

export const SignerResponseSchema = z
  .object({
    walletAddress: z.string().min(32),
    keyId: z.string().min(1).optional(),
    signedTransactions: z.array(SignerResponseItemSchema).min(1),
  })
  .strict();

export type SignerResponse = z.infer<typeof SignerResponseSchema>;

export type SignerFailureCode =
  | "SIGNER_DISABLED"
  | "SIGNER_TIMEOUT"
  | "SIGNER_UNAVAILABLE"
  | "SIGNER_AUTH_FAILED"
  | "SIGNER_BAD_RESPONSE"
  | "SIGNER_WALLET_MISMATCH"
  | "SIGNER_REQUEST_INVALID";

export class SignerError extends Error {
  constructor(
    public readonly code: SignerFailureCode,
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = "SignerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface Signer {
  readonly mode: SignerMode;
  readonly keyId?: string;
  sign(request: SignerRequest): Promise<SignerResponse>;
}

export interface SignerConfigShape {
  signerMode: SignerMode;
  signerUrl?: string;
  signerAuthToken?: string;
  signerKeyId?: string;
  signerTimeoutMs?: number;
}

export function validateSignerResponseMatchesRequest(
  request: SignerRequest,
  response: SignerResponse
): void {
  if (response.walletAddress !== request.walletAddress) {
    throw new SignerError(
      "SIGNER_WALLET_MISMATCH",
      "Remote signer response walletAddress did not match the requested walletAddress."
    );
  }

  if (response.signedTransactions.length !== request.transactions.length) {
    throw new SignerError(
      "SIGNER_BAD_RESPONSE",
      "Remote signer response item count did not match the request item count."
    );
  }

  const requestById = new Map(request.transactions.map((item) => [item.id, item]));
  for (const signedItem of response.signedTransactions) {
    const original = requestById.get(signedItem.id);
    if (!original) {
      throw new SignerError(
        "SIGNER_BAD_RESPONSE",
        `Remote signer response contained unexpected item '${signedItem.id}'.`
      );
    }

    if (signedItem.kind !== original.kind || signedItem.encoding !== original.encoding) {
      throw new SignerError(
        "SIGNER_BAD_RESPONSE",
        `Remote signer response item '${signedItem.id}' did not preserve the requested payload shape.`
      );
    }
  }
}
