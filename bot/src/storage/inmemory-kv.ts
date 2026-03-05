/**
 * M7: In-memory KV for idempotency (dev).
 */
import type { IdempotencyStore } from "./idempotency-store.js";

interface Entry {
  value: unknown;
  expiresAt?: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, Entry>();

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async put(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.store.set(key, { value, expiresAt });
  }
}
