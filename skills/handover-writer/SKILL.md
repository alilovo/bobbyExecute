---
name: handover-writer
description: Produce a precise handover summary, current state, completed work, open issues, and the best next-step prompt for another agent.
disable-model-invocation: true
---

# Handover Writer

Use this only when explicitly requested.

Produce:
- concise current-state summary
- what changed
- what remains
- constraints and decisions
- exact next-step prompt for the next agent

Output format:
- Summary
- Completed
- Open
- Risks / blockers
- Recommended next step
- Ready-to-paste next prompt
