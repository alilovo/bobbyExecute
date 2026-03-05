/**
 * M7: Idempotency Store - prevent duplicate execution.
 */
export interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  put(key: string, value: unknown, ttlMs?: number): Promise<void>;
}

export const IDEMPOTENCY_REPLAY_BLOCK = "IDEMPOTENCY_REPLAY_BLOCK";
