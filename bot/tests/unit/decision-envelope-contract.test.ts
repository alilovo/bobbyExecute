import { describe, expect, it } from "vitest";
import { assertDecisionEnvelope } from "../../src/core/contracts/decision-envelope.js";
import { buildDecisionEnvelopeFixtureSet } from "../fixtures/decision-envelope.fixtures.js";

describe("decision envelope contract", () => {
  it("accepts the shared valid envelope fixtures", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();

    expect(assertDecisionEnvelope(fixtures.allowEnvelope, "shared-fixture:allow")).toEqual(
      fixtures.allowEnvelope
    );
    expect(assertDecisionEnvelope(fixtures.denyEnvelope, "shared-fixture:deny")).toEqual(fixtures.denyEnvelope);
  });

  it("rejects the shared malformed envelope fixtures", async () => {
    const fixtures = await buildDecisionEnvelopeFixtureSet();

    for (const [index, envelope] of fixtures.invalidEnvelopes.entries()) {
      expect(() => assertDecisionEnvelope(envelope, `shared-fixture:${index}`)).toThrow(
        new RegExp(`INVALID_DECISION_ENVELOPE:shared-fixture:${index}`)
      );
    }
  });
});
