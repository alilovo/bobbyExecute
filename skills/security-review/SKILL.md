---
name: security-review
description: Review code and architecture for real security risks, exploitability, unsafe trust assumptions, and missing safeguards.
---

# Security Review

Focus on:
- exploitability
- permission boundaries
- secrets exposure
- injection vectors
- unsafe automation
- auth/authz gaps
- tenant isolation failures
- fail-open behavior

Avoid:
- low-value lint-like nits
- speculative issues without plausible impact

Output format:
- Findings
- Severity
- Exploit path
- Impact
- Suggested fix
- Confidence
