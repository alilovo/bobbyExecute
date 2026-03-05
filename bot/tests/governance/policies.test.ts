/**
 * M9: Governance Policies tests.
 */
import { describe, expect, it } from "vitest";
import { evaluateApproval } from "@bot/governance/policies/approval.js";
import { evaluateFailClosed } from "@bot/governance/policies/fail-closed.js";

describe("evaluateApproval", () => {
  it("AUTO_DENY always denies", () => {
    expect(evaluateApproval({ gateType: "AUTO_DENY" }).allow).toBe(false);
  });

  it("live trade without approval denied for REQUIRE_REVIEW", () => {
    const r = evaluateApproval({ gateType: "REQUIRE_REVIEW" }, { dryRun: false });
    expect(r.allow).toBe(false);
  });

  it("ALLOW_PAPER_ONLY denies live", () => {
    const r = evaluateApproval(
      { gateType: "ALLOW_PAPER_ONLY" },
      { dryRun: false }
    );
    expect(r.allow).toBe(false);
  });
});

describe("evaluateFailClosed", () => {
  it("denies when completeness below threshold", () => {
    const r = evaluateFailClosed({ completeness: 0.5 });
    expect(r.allow).toBe(false);
  });
});
