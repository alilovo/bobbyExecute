---
name: architecture-planner
description: Analyze repository state, infer target architecture, and produce a phased execution plan with risks and verification points.
---

# Architecture Planner

Use this skill when:
- the user asks for an architecture review
- a repo needs target-state planning
- a feature spans multiple modules
- migration/refactor planning is needed

Your job:
1. Identify current state.
2. Infer target state from repo context and request.
3. Describe gaps.
4. Produce a phased implementation path.
5. Include risks, dependencies, and verification points.
6. Distinguish must-have vs optional improvements.

Output format:
- Objective
- Current State
- Target State
- Gaps
- Execution Waves
- Risks
- Verification
- Recommended next step

Guardrails:
- Do not overfit to one file.
- Do not recommend broad rewrites unless justified.
- Prefer minimal viable architecture progress.
