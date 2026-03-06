# BobbyExecution Specification Generation Protocol

Every BobbyExecution spec must be implementation-ready and must describe the system that will
actually be built.

## Required sections

1. Overview
2. Goal
3. Current state
4. Non-goals
5. Architecture
6. Components
7. Interfaces and contracts
8. Data model
9. Decision and gate flow
10. Failure handling
11. Observability
12. Security and policy controls
13. Persistence
14. Dashboard integration
15. Test strategy
16. Rollout plan
17. Live-test implications
18. Documentation updates

## Mandatory contracts

Include explicit schemas or field definitions for:

- market snapshot
- score card
- trade intent
- policy result
- chaos result
- execution report
- RPC verification report
- journal entry
- KPI summary payload

## Mandatory safety sections for live-execution specs

- execution prerequisites
- route and quote validation
- slippage limits
- timeout / retry strategy
- fallback behavior
- kill-switch integration
- rollback procedure
- operator monitoring requirements

## Minimum implementation-plan quality bar

The implementation plan must include:

- exact files or modules affected
- expected behavior after change
- migration or compatibility notes
- tests to add or update
- docs to update
