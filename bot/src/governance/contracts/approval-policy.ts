/**
 * M9: Approval Policy - Zod contract.
 */
import { z } from "zod";

export const ApprovalPolicySchema = z.object({
  gateType: z.enum(["AUTO_DENY", "REQUIRE_REVIEW", "ALLOW_PAPER_ONLY"]),
  approved: z.boolean().optional(),
});

export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
