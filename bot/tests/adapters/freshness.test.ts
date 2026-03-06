/**
 * Freshness validation - parseDataTimestamp, validateFreshness.
 */
import { describe, expect, it } from "vitest";
import { parseDataTimestamp, validateFreshness } from "@bot/adapters/freshness.js";

describe("parseDataTimestamp", () => {
  it("returns undefined for null/undefined", () => {
    expect(parseDataTimestamp(null)).toBeUndefined();
    expect(parseDataTimestamp(undefined)).toBeUndefined();
  });

  it("parses last_updated ISO string", () => {
    const ts = new Date("2025-01-15T12:00:00Z").getTime();
    const raw = { last_updated: "2025-01-15T12:00:00.000Z" };
    expect(parseDataTimestamp(raw)).toBe(ts);
  });

  it("parses Unix seconds", () => {
    const raw = { timestamp: 1736932800 };
    expect(parseDataTimestamp(raw)).toBe(1736932800000);
  });

  it("parses Unix ms", () => {
    const raw = { updated_at: 1736932800000 };
    expect(parseDataTimestamp(raw)).toBe(1736932800000);
  });

  it("returns undefined when no timestamp field", () => {
    expect(parseDataTimestamp({ id: "x" })).toBeUndefined();
  });
});

describe("validateFreshness", () => {
  it("does not throw when no timestamp in raw", () => {
    expect(() => validateFreshness({ id: "x" })).not.toThrow();
  });

  it("does not throw when data is fresh", () => {
    const raw = { last_updated: new Date().toISOString() };
    expect(() => validateFreshness(raw, 30_000)).not.toThrow();
  });

  it("throws when data is stale", () => {
    const raw = { last_updated: new Date(Date.now() - 60_000).toISOString() };
    expect(() => validateFreshness(raw, 30_000)).toThrow(/Stale data/);
  });
});
