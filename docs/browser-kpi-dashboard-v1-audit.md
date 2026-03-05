# Browser KPI Dashboard V1 — Repo Audit

**Datum:** 2026-03-05  
**Repository:** dotBot / BobbyExecute  
**Scope:** Browser KPI Interface V1 — minimal, observability-first

---

## 0) Web Surface & Placement Decision

### Existing web/http modules:
- **dor-bot/dor-bot/server.py** — FastAPI + Uvicorn auf Port 8000
  - `GET /` → HTML (dashboard.html)
  - `GET /api/status`, `/api/stats`, `/api/balance`, `/api/positions`, `/api/trades`, `/api/wallet`, `/api/logs`, `/api/config`, `/api/backtest`, `/api/ml_status`, `/api/recap`
  - `POST /api/config`, `/api/bot/start`, `/api/bot/stop`, `/api/sell`, `/api/sell_all`
- **dor-bot/dor-bot/dashboard.html** — Einzelne HTML-Seite mit Polling (2s), CRT-Style UI

### Bot (Node/TS):
- **Kein HTTP-Server** — `bot/` ist reine Library (Engine, Orchestrator, Adapters, Contracts)
- Kein Express/Fastify/NestJS, keine `/metrics` oder `/health`
- `validate:openapi` in package.json referenziert `docs/architecture/openapi.yaml` — **Datei existiert nicht** (0 Treffer)

### Recommended V1 dashboard placement:
- **Option C** (angepasst): Bestehendes dor-bot Dashboard erweitern ODER kleinstes neues Dashboard für **bot/**-Pipeline
- **Begründung:**
  - dor-bot ist Python/Legacy, nutzt `memory.json`, `positions.json`, `bot.log` — **nicht** die TS-bot Pipeline
  - bot/ hat Engine, Orchestrator, Adapters, aber **keine HTTP-Oberfläche**
  - V1 sinnvoll als: **Option B** — `/dashboard` vom bestehenden API-Server (dor-bot) ODER neuer **minimaler HTTP-Wrapper** um bot/, der JSON-Endpoints bereitstellt
- **Empfehlung:** Neuer Ordner `bot/server/` oder `web/` mit:
  - minimalem Express/Fastify-Server (1 Datei)
  - Static-Serving einer einfachen SPA oder statischen HTML-Seite
  - JSON-Endpoints, die bot-Module ansprechen

---

## 1) Adapter Catalog

| Adapter | Path | Inputs | Outputs | Failover/Caching |
|---------|------|--------|---------|------------------|
| DexPaprikaClient | `bot/src/adapters/dexpaprika/client.ts` | tokenId, network | getToken, getTokenPools, getPools; raw + rawPayloadHash | **missing** — kein Retry, kein Timeout, throws bei !res.ok |
| DexScreenerClient | `bot/src/adapters/dexscreener/client.ts` | tokenAddress, chainId, pairId, query | DexScreenerTokenResponse, PairInfo; *WithHash Varianten | **missing** — kein Retry, kein Timeout |
| MoralisClient | `bot/src/adapters/moralis/client.ts` | address, chain | getTokenBalances; raw + rawPayloadHash | **missing** — kein Retry; API-Key optional |
| RpcClient (StubRpcClient) | `bot/src/adapters/rpc-verify/client.ts` | address, mint, signature | TokenInfo, BalanceResult | **Stub** — keine echte RPC-Anbindung |
| dex-execution (quotes, swap) | `bot/src/adapters/dex-execution/quotes.ts`, `swap.ts` | TradeIntent | QuoteResult, ExecutionReport | **minimal** — simuliert; kein Retry |
| dor-bot RPC (aiohttp) | `dor-bot/dor-bot/server.py` | getBalance, getTokenAccountsByOwner | JSON-RPC response | Inline in API-Handlern; kein zentraler Client |

---

## 2) Metrics Registry

| Metric | Path | Formula Summary | Output Fields | Dependencies |
|--------|------|-----------------|---------------|--------------|
| MCI (Market Confidence Index) | `bot/src/core/intelligence/mci-bci-formulas.ts` | Momentum aus ersten/letzten Preisen; Age-Decay (exp); Double-Penalty bei crossSourceVariance > 0.3 | mci ∈ [-1,1] | SignalPack, RawSignal[] |
| BCI (Belief Confidence Index) | `bot/src/core/intelligence/mci-bci-formulas.ts` | 0.5*completeness + 0.5*freshness (DataQuality) | bci ∈ [-1,1] | DataQuality |
| Hybrid | `bot/src/core/intelligence/mci-bci-formulas.ts` | 0.55*MCI + 0.45*BCI (Target Architecture) | hybrid ∈ [-1,1] | MCI, BCI |
| crossSourceConfidenceScore | `mci-bci-formulas.ts`, `dataquality.ts` | (completeness + freshness + reliability)/3 oder crossSourceConfidence | ∈ [0,1] | SignalPack.dataQuality |
| DataQuality (completeness, freshness) | `bot/src/core/contracts/dataquality.ts` | Manuell/Adapter-Aggregation; discrepancy via sMAPE | completeness, freshness, sourceReliability, discrepancy | Adapter-Aggregation |
| confidence_score (TokenUniverse) | `bot/src/adapters/dexscreener/mapper.ts` | 0.5 + rawScore*0.5; raw = 0.5*liqScore + 0.3*pairCount + 0.2*volScore | ∈ [0.5,1] | Pairs, Liquidity, Volume |
| Win Rate, PNL, Threshold, Drawdown | `dor-bot/dor-bot/server.py` | Aus memory.json trades aggregiert; backtest walk-forward | win_rate, pnl_sol, threshold, max_drawdown | memory.json, trades[] |
| Chaos Pass Rate | `bot/src/governance/chaos-gate.ts` | 19 Szenarien; passRate >= 98%; Cat 5 → abort | passRate, auditHashChain | chaos-suite |

**Update Cadence:** Keine feste Cadence im Code; Orchestrator/Engine laufen pro Run; dor-bot: Polling 2s.

---

## 3) Signals & Risk Models

### Signals
- **SignalPack** (`bot/src/core/contracts/signalpack.ts`): sources moralis, dexscreener, paprika, x_tl_keyword, x_tl_semantic
- **RawSignal**: source, timestamp, poolId, baseToken, quoteToken, priceUsd, volume24h, liquidity, rawPayloadHash
- **Signal Agent** (`bot/src/agents/signal.agent.ts`): Rule-based; direction "hold", confidence 0.5 wenn priceUsd>0 && volume24h>0
- **CQD Snapshot** (`bot/src/core/contracts/cqd.ts`): price_return_1m, volume_1m, confidence, anomaly_flags

### Risk Models
- **Risk Agent** (`bot/src/agents/risk.agent.ts`): maxSlippagePercent, allowlist/denylist Mints
- **Guardrails** (`bot/src/governance/guardrails.ts`): checkFeatureEnabled, checkPermissions, checkSideEffectsReviewGate
- **Pattern Engine** (`bot/src/patterns/pattern-engine.ts`): 8 Patterns (velocity_liquidity_divergence, bundle_sybil_cluster, narrative_shift, smart_money_fakeout, early_pump_risk, sentiment_structural_mismatch, cross_source_anomaly, fragile_expansion)
- **Chaos Gate** (`bot/src/governance/chaos-gate.ts`): MIN_PASS_RATE 0.98; Kategorie 5 → sofortiger Abort
- **DataQuality Fail-Closed** (`bot/src/memory/memory-db.ts`): completeness < 0.7 → renew() wirft

---

## 4) Events / Logs / Decision Trace

### Event Types (mit File-Refs)
- **ActionLogEntry** (`bot/src/observability/action-log.ts`): agentId, userId, action, input, output, ts, blocked, reason, traceId, skillId, skillStatus, skillDurationMs
- **LogEntry** (`bot/src/memory/log-append.ts`): traceId, timestamp, stage, decisionHash, resultHash, input, output
- **CompressedJournalEntry** (`bot/src/memory/memory-db.ts`): traceId, timestamp, hash, compressed, prevHash
- **dor-bot log_lines** (`dor-bot/dor-bot/server.py`): time, level, msg (In-Memory, max 500)

### Decision Trace Shape
```
inputs  → intentSpec (Orchestrator) / market+wallet (Engine)
       → SignalPack (Research)
       → ScoreCard (computeScoreCard)
       → PatternResult (recognizePatterns)
       → DecisionResult (toDecisionResult)
       → risk allowed/denied
       → executionReport, rpcVerification
       → journalEntry { decisionHash, resultHash, input, output }
outputs → decision (allow|deny), direction (buy|sell|hold), confidence, evidence, rationale
```

### Fehlende persistente Event-Stores
- ActionLogger: InMemoryActionLogger nur; **keine Persistenz**
- MemoryLog: In-Memory entries; **keine DB**
- dor-bot: log_lines nur im Prozess

---

## 5) HTTP Endpoints

### Existing endpoints (dor-bot)

| Route | Method | Response Shape | Source |
|-------|--------|----------------|--------|
| / | GET | HTML | dashboard.html |
| /api/status | GET | `{ running, uptime, libs, mode }` | state |
| /api/stats | GET | `{ total_trades, real_trades, win_rate, pnl_sol, threshold, loss_streak, strategy_stats, avg_win, avg_loss }` | memory.json |
| /api/balance | GET | `{ sol, balance_sol }` | memory.json + RPC |
| /api/positions | GET | `[{ mint, token_name, strategy, entry_price, amount_sol, opened_at, signal_score, ... }]` | positions.json |
| /api/trades | GET | `[{ ts, name, mint, strat, pnl_pct, pnl_sol, hold_min, reason, score }]` | memory.json |
| /api/wallet | GET | `{ sol_balance, address, tokens: [{mint, ui_amount}] }` | RPC |
| /api/logs | GET | `[{ time, level, msg }]` | state.log_lines |
| /api/config | GET | config dict | config.json |
| /api/config | POST | `{ ok }` | config.json |
| /api/bot/start | POST | `{ ok, msg }` | state |
| /api/bot/stop | POST | - | state |
| /api/backtest | GET | `{ n, win_rate, max_drawdown, total_return_pct, final_equity, equity_curve }` | memory.json |
| /api/ml_status | GET | `{ threshold, ql_states, trend, avg_win, avg_loss, kelly_fraction, atr_period }` | memory.json |
| /api/recap | GET | `[{ ts, name, pnl_pct, pnl_sol, hold_min, sentence }]` | memory.json |
| /api/sell | POST | `{ ok, tx, solscan }` | Jupiter + RPC |
| /api/sell_all | POST | `{ ok, sold, failed, total_sol, results }` | Jupiter + RPC |

### Bot (Node/TS): keine HTTP-Endpoints

### Required minimal endpoints for V1 dashboard (bot-Pipeline)

| Endpoint | Response JSON Shape | Source Modules |
|----------|---------------------|----------------|
| GET /health | `{ ok: boolean, version?: string, uptime_s?: number }` | - |
| GET /kpi/summary | `{ mci, bci, hybrid, crossSourceConfidence, lastTraceId, timestamp }` | Orchestrator state, ScoreCard |
| GET /kpi/market | `{ baseToken, quoteToken, priceUsd, volume24h, liquidity, source }` | MarketSnapshot, Adapters |
| GET /kpi/risk | `{ chaosPassed, passRate, blocked, blockedReason }` | chaos-gate, Engine state |
| GET /kpi/performance | `{ totalTrades, winRate, pnl, maxDrawdown }` | **missing** — benötigt RunArtifact/DB |
| GET /decisions?limit=50 | `{ items: [{ traceId, timestamp, decision, direction, confidence, rationale }] }` | MemoryLog.getEntries() |
| GET /tokens?limit=100 | `{ tokens: NormalizedTokenV1[] }` | TokenUniverse, DexScreener mapPairsToTokenUniverse |

**Caching:** Kein Caching definiert; Polling 5–15s empfohlen.  
**Error Handling:** Fail-closed: bei Fehler `{ ok: false, reason: string }` oder `null` + 503.

---

## 6) Observable Data Surface (What we can visualize NOW)

| Kategorie | Verfügbar | Quelle | Einschränkung |
|-----------|-----------|-------|---------------|
| **Executive KPIs** | mci, bci, hybrid, crossSourceConfidence | ScoreCard | Pro Run; kein Aggregat über Zeit |
| **Market Intelligence** | priceUsd, volume24h, liquidity, baseToken, quoteToken | MarketSnapshot, DexPaprika/DexScreener | Pro Ingestion |
| **Risk** | chaosPassed, passRate, blocked, blockedReason, riskAllowed | chaos-gate, Engine, Risk Agent | Pro Run |
| **Performance** | win_rate, pnl_sol, max_drawdown | dor-bot memory.json | **Nur dor-bot**; bot/ hat kein PnL-Tracking |
| **Token Universe** | NormalizedTokenV1[] mit symbol, mint, confidence_score | DexScreener mapPairsToTokenUniverse | Pro Token-Pairs-Request |
| **Decisions/Timeline** | traceId, decision, direction, rationale | MemoryLog, ActionLogger | In-Memory; kein Persist |
| **Infra Health** | - | - | **missing** — kein /health, keine Adapter-Health-Checks |

---

## 7) Gaps (Must-fix for useful V1 dashboard)

### Missing adapters
- Keine fehlenden Adapter für V1; DexScreener, DexPaprika, Moralis vorhanden

### Missing metrics
- **RunArtifact / PnL-Tracking** — bot/ speichert keine Trades; Performance-KPIs nur in dor-bot
- **Structured metrics** — audit-report erwähnt `bot/src/observability/metrics.ts`; **Datei existiert nicht** (Counter, Histogram, Gauge)
- **Adapter Latency** — nicht gemessen

### Missing logs/events
- **Persistente Action/Decision Logs** — InMemory only; kein Export für Dashboard
- **run_id / snapshot system** — traceId pro Run, aber keine zentrale Run-Artifact-Speicherung

### Missing endpoints
- **GET /health** — fehlt in beiden Systemen als dedizierter Endpoint (dor-bot hat /api/status)
- **GET /kpi/*** — alle fehlen für bot/
- **GET /decisions** — MemoryLog hat getEntries(), aber kein HTTP-Zugang
- **GET /tokens** — DexScreener kann liefern, aber kein Endpoint

---

## 8) V1 Browser Dashboard Spec (1 page + optional details)

### Pages
- `/dashboard` (main)
- optional: `/tokens/:id`, `/decisions/:id`

### Panels (ordered top-down)
1. **Exec KPIs** — hybrid, mci, bci, crossSourceConfidence, lastUpdate
2. **Market** — priceUsd, volume24h, liquidity, baseToken/quoteToken
3. **Risk** — chaosPassed, blocked, blockedReason, riskAllowed
4. **Performance** — (wenn dor-bot) win_rate, pnl_sol, max_drawdown; sonst "N/A"
5. **Token Universe** — Tabelle symbol, mint, confidence_score (Top 20)
6. **Decision Log** — letzte 20 Entscheidungen (traceId, decision, direction, rationale)
7. **Infra Health** — ok, uptime, Adapter-Status (wenn implementiert)

### Data refresh approach
- **Polling 5–15s** — empfohlen; dor-bot nutzt 2s
- **SSE** — optional in V2; kein Code vorhanden

### Minimal UI-Design-Vorgaben
- 1 Seite: `/dashboard`
- 2 Details optional: Token-Detail, Decision-Detail
- Polling statt WebSocket
- Read-only (kein Button außer Refresh)
- Status-Farben nur für: health (grün/rot), risk (blocked = rot), alerts

---

## Appendix: File References

| Konzept | Pfad |
|---------|------|
| Engine Pipeline | `bot/src/core/engine.ts` |
| Orchestrator | `bot/src/core/orchestrator.ts` |
| ScoreCard/MCI/BCI | `bot/src/core/intelligence/mci-bci-formulas.ts` |
| Pattern Engine | `bot/src/patterns/pattern-engine.ts` |
| DecisionResult | `bot/src/core/contracts/decisionresult.ts` |
| MemoryLog | `bot/src/memory/log-append.ts` |
| MemoryDB | `bot/src/memory/memory-db.ts` |
| Chaos Gate | `bot/src/governance/chaos-gate.ts` |
| dor-bot Server | `dor-bot/dor-bot/server.py` |
| dor-bot Dashboard | `dor-bot/dor-bot/dashboard.html` |
| Audit Report | `audit-report-03_03.md` |
