# Systems Thinking Framework for BobbyExecution

Use this framework to analyze the trading system as a whole.

## 1. Define boundaries

Explicitly separate:

- `bot/` runtime
- `dor-bot` dashboard service
- market data providers
- RPC providers
- execution venues
- persistence layer
- operator controls

## 2. Identify subsystems

Minimum subsystem map:

- ingestion
- normalization
- scoring
- signal generation
- risk
- chaos / manipulation checks
- execution
- verification
- journaling
- metrics
- dashboard transport
- incident controls

## 3. Map interactions

For each subsystem define:

- input
- output
- source of truth
- freshness expectation
- failure mode
- fallback behavior

## 4. Detect feedback loops

Critical BobbyExecution feedback loops:

- signal → trade → verification → journal → dashboard
- adapter failures → circuit breaker → blocked execution
- chaos failures → abort → operator alert
- stale data → confidence degradation → trade suppression

## 5. Identify constraints

Always evaluate:

- latency tolerance
- API rate limits
- RPC reliability
- stale market data
- wallet balance truth
- slippage exposure
- capital protection
- operator visibility

## 6. Evaluate emergent risks

Examples:

- dashboard shows healthy state while bot is degraded
- swap succeeds but journal fails
- bot uses stale data because adapter fallback is absent
- live trading enabled while chaos coverage is incomplete
- RPC verification looks successful due to stub mode

## Mandatory BobbyExecution analysis questions

- what is the truth source for each trading decision?
- what blocks live execution?
- what happens on partial failure?
- what is persisted?
- what can the operator see in time to intervene?
- what exact event should trigger emergency stop?
