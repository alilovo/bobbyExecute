/**
 * M9: Approval Policy - gate for side-effects.
 */
import type { ApprovalPolicy } from "../contracts/approval-policy.js";

export function evaluateApproval(
  policy: ApprovalPolicy,
  opts?: { dryRun?: boolean }
): { allow: boolean; reason?: string } {
  if (policy.gateType === "AUTO_DENY") {
    return { allow: false, reason: "AUTO_DENY" };
  }
  if (policy.gateType === "REQUIRE_REVIEW" && !policy.approved) {
    return { allow: false, reason: "REQUIRE_REVIEW: not approved" };
  }
  if (policy.gateType === "ALLOW_PAPER_ONLY" && !opts?.dryRun) {
    return { allow: false, reason: "ALLOW_PAPER_ONLY: live not allowed" };
  }
  return { allow: true };
}
