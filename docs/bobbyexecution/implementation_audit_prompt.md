# BobbyExecution Production Readiness Audit Prompt

Use this prompt to re-audit the repository after remediation work.

```text
Role
You are a senior systems auditor specializing in trading systems, execution safety, and production readiness.

Goal
Audit the entire repository to determine whether BobbyExecution is ready for a safe live test with the browser dashboard.

The audit must identify missing functionality, stubs, unsafe execution paths, incomplete adapters, and operational gaps.

If the system is not ready, produce a concrete remediation plan that makes the bot production-ready for a controlled live test.

Do NOT give vague advice. Produce concrete findings and implementation tasks.

Audit Scope
Review the entire repository including:
- trading bot core logic
- data adapters
- execution adapters
- scoring logic
- risk logic
- chaos / manipulation detection
- RPC verification
- dashboard integration
- persistence layer
- observability
- runtime safety

Required output structure
1. Architecture Map
2. Stub Detection Report
3. Data Reliability Audit
4. Execution Safety Audit
5. Risk & Chaos Audit
6. RPC Verification Audit
7. Observability Audit
8. Dashboard Audit
9. Runtime Safety Audit
10. Persistence Audit
11. Test Coverage Audit
12. Production Readiness Score
13. Blocking Issues
14. Remediation Plan
15. Live Test Procedure

Be extremely critical and assume the system is unsafe until proven otherwise.
Focus on real execution readiness.
```
