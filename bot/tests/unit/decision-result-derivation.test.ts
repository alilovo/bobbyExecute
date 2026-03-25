import { describe, expect, it } from "vitest";
import { deriveDecisionResult } from "../../src/core/decision/decision-result-derivation.js";
import { buildDecisionEnvelopeFixtureSet } from "../fixtures/decision-envelope.fixtures.js";

describe("decision result derivation", () => {
  it("derives a stable allow result from the shared evidence fixture", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const derived = deriveDecisionResult(
      fixtures.traceId,
      fixtures.timestamp,
      fixtures.scoreCard,
      fixtures.patternResult,
      { ...fixtures.riskBreakdown, aggregate: 0.12 }
    );

    expect(derived.traceId).toBe(fixtures.traceId);
    expect(derived.timestamp).toBe(fixtures.timestamp);
    expect(derived.decision).toBe("allow");
    expect(derived.direction).toBe("buy");
    expect(derived.decisionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(derived.evidence).toEqual(fixtures.patternResult.evidence.map((e) => ({ id: e.id, hash: e.hash, type: "pattern", value: undefined })));
  });

  it("derives a deny result when risk is explicitly too high", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();
    const derived = deriveDecisionResult(
      fixtures.traceId,
      fixtures.timestamp,
      fixtures.scoreCard,
      fixtures.patternResult,
      { ...fixtures.riskBreakdown, aggregate: 0.9 }
    );

    expect(derived.decision).toBe("deny");
    expect(derived.direction).toBe("buy");
    expect(derived.rationale).toContain("decision=deny");
  });
});
