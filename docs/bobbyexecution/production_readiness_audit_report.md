# BobbyExecution – Production Readiness Audit Report

**Date:** 2026-03-06  
**Repository:** dotBot / BobbyExecute  
**Scope:** Vollständige Auditierung für kontrollierten Live-Test mit Browser-Dashboard  
**Methodik:** System ist als unsicher zu betrachten, bis das Gegenteil bewiesen ist.

## 1. Architecture Map

| Component | Responsibility | Input | Output | Dependencies |
|---|---|---|---|---|
| DexPaprikaClient | Token-, Pool- und Liquiditätsdaten | tokenId, network | `getToken`, `getTokenPools`, `getPools`, `*WithHash` | `resilientFetch`, `sha256` |
| DexScreenerClient | Token-Paare, Suche, Boost-Daten | tokenAddress, chainId, pairId, query | `DexScreenerTokenResponse` | `resilientFetch`, `sha256` |
| MoralisClient | Wallet-Balances, Transfers | address, chain | `getTokenBalances` | `resilientFetch`, `sha256` |
| Ingest Agent | Parallel-Abfrage der Adapter | walletAddress | `{ market, wallet }` | DexPaprika, Moralis / DexScreener |
| MCI / BCI / Hybrid | Scoring | `SignalPack` | `ScoreCard` | `DataQuality`, `RawSignal[]` |
| Pattern Engine | 8 feste Patterns | `ScoreCard`, `SignalPack` | `PatternResult` | velocity, liquidity, narrative |
| Signal Agent | Richtungslogik | `MarketSnapshot` | direction, confidence, cqd | Regeln |
| Risk Agent | Guardrails | `TradeIntent`, Market, Wallet | allowed, reason | `guardrails.yaml` |
| Chaos Gate | 19 Szenarien, 98 % Pass Rate | - | `ChaosTestReport`, abort bei Cat-5-Fail | `chaos-suite` |
| Circuit Breaker | Adapter-Health, Fail-Closed | - | `requireHealthy`, `reportHealth` | Adapters |
| Swap | Swap-Ausführung | `TradeIntent` | `ExecutionReport` | - |
| RPC Verify | Token / Balance / Tx-Prüfung | address, mint, signature | `RpcVerificationReport` | `RpcClient` |
| MemoryDB | Snapshot-Memory | `SignalPack`, `ScoreCard` | compressed snapshot | `DataQuality ≥ 70 %` |
| MemoryLog | Append-only Hash-Chain | `LogEntry` | `LogAck` | `canonicalize` |
| JournalWriter | Journal-Einträge | `JournalEntry` | FileSystem / InMemory | - |
| ActionLog | Strukturierte Aktionen | `ActionLogEntry` | In-memory | - |
| Orchestrator | 7-Phasen-Pipeline | `IntentSpec` | `OrchestratorState` | Research, Vault, focusedTx |
| Engine | Ingest→Signal→Risk→Execute→Verify→Journal→Monitor | Handlers | `EngineState` | Handlers |
| dor-bot Server | FastAPI, Port 8000 | HTTP | HTML, JSON | `memory.json`, `positions.json`, SQLite |
| KPI Router | `/kpi/*` Endpoints | - | summary, market, adapters, decisions | `metrics_store`, `decision_store`, `adapter_health` |

## 2. Stub Detection Report

| File | Function | Current Behavior | Impact | Required Fix |
|---|---|---|---|---|
| `bot/src/adapters/dex-execution/swap.ts` | `executeSwap` | Bei `LIVE_TRADING=true` wirft `throw new Error("Real swap execution not implemented")` | Kein echter DEX-Swap möglich | Jupiter / Raydium Integration |
| `bot/src/adapters/rpc-verify/client.ts` | `StubRpcClient` | Default: `getRpcMode() = "stub"` → Fake-Balances, `exist=true` | Keine echte Onchain-Prüfung | `RPC_MODE=real` + `SolanaWeb3RpcClient` |
| `bot/src/config-loader/secrets.ts` | `HashiCorpVaultProvider` | `get()` liefert `undefined`, keine Vault-API | Keine Vault-Integration | Echte Vault-API |
| `bot/src/chaos/chaos-suite.ts` | Szenarien 1–11, 15 | `async () => true` | Kritische Teile der Chaos-Suite stubbed | Implementierung der Stub-Szenarien |
| `bot/src/core/config/rpc.ts` | `getRpcMode` | Default `"stub"` | RPC bleibt Stub | `RPC_MODE=real` explizit |
| `bot/src/adapters/dex-execution/quotes.ts` | Quote-Service | Stub | Keine echten Quotes | Jupiter Quote API |
| `bot/src/core/tool-router.ts` | Tool-Handler | `error: Tool handler not implemented` | Nicht alle Tools implementiert | Implementierung oder Entfernung |

**Szenarien mit echter Logik:** 12, 13, 14, 16, 17, 18, 19.  
**Szenario 15 (MEV / Sandwich):** Stub.

## 3. Data Reliability Audit

**Data Reliability Score:** `5 / 10`

| Kriterium | Status | Details |
|---|---|---|
| Timeout | ✅ | 10s via `resilientFetch` |
| Retry | ⚠️ | Nur bei 429 und AbortError/fetch; kein Retry bei 5xx |
| Fallback | ❌ | Kein Cache, kein Secondary Endpoint |
| Freshness Check | ❌ | Kein expliziter Freshness-Check |
| Rate Limit | ⚠️ | 429 mit Retry-After, aber keine strukturierte Queue |
| Data Validation | ✅ | Zod-Schemas für Contracts |
| Circuit Breaker | ✅ | Mit `resilientFetch` verbunden |

**Fehlende Implementierungen:**

- Retry bei 5xx in `http-resilience.ts`
- Fallback-Cache bei Adapter-Ausfall
- Freshness-Validierung für Market-Daten
- Alternative Endpoints / Provider-Fallback

## 4. Execution Safety Audit

**Execution Readiness:** `Not Ready`

| Check | Status | Details |
|---|---|---|
| Echte DEX-Integration | ❌ | `executeSwap` wirft bei Live |
| Route Validation | ❌ | Keine Route-Prüfung vor Swap |
| Slippage Protection | ⚠️ | Nur im Intent, nicht robust im Execution-Pfad |
| Transaction Confirmation | ⚠️ | Bei Stub-RPC fake |
| Failure Handling | ⚠️ | Paper-Modus gibt oft implizit Erfolg |

**Fehlende Safety Checks:**

- realer Jupiter / Raydium-Swap
- Quote-vor-Swap-Validierung
- Simulation vor Live-TX
- expliziter Max-Slippage-Check

## 5. Risk & Chaos Layer Audit

**Risk Layer Status:** `Partially Implemented`

| Komponente | Status | Details |
|---|---|---|
| Chaos Gate | ⚠️ | 8 von 19 Szenarien mit echter Logik |
| Manipulation Detection | ✅ | Divergence, Pump/Velocity, Liquidity Drain |
| Cat-5 Abort | ✅ | `shouldAbort()` bei Cat-5-Fail |
| 98 % Pass Rate | ✅ | `MIN_PASS_RATE = 0.98` |
| MEV / Sandwich (15) | ❌ | Stub |

**Fehlende Logik:**

- Szenarien 1–11 weitgehend Stub
- Szenario 15 ohne Implementierung
- keine echte Rug-Indikator-Logik
- keine explizite Volume-Anomalie in Chaos-Suite

## 6. RPC Verification Audit

**RPC Verification Status:** `Partial`

| Modus | Verhalten | Verwendung |
|---|---|---|
| `RPC_MODE=stub` | Fake-Balances, `exist=true` | Paper / Test |
| `RPC_MODE=real` | echte RPC-Calls | Produktion |

**Probleme:**

- `decimals` immer 9
- kein RPC-Failover
- keine Timeout-Konfiguration für Connection
- `record_adapter_status` wird nie aufgerufen

## 7. Observability Audit

**Observability Score:** `4 / 10`

| Komponente | Status | Details |
|---|---|---|
| Action Log | ❌ | In-Memory |
| Trade Log | ⚠️ | JournalWriter optional |
| Error Log | ⚠️ | Pino nicht überall integriert |
| Metrics | ⚠️ | in-memory, keine Persistenz |
| Dashboard Data | ⚠️ | dor-bot nutzt eigene Datenbasis |
| Trace Correlation | ⚠️ | keine einheitliche run_id-Kette |

**Fehlende Teile:**

- persistenter Action / Decision Log
- Integration `bot/ → dashboard`
- Adapter-Health reporting
- Prometheus / OpenTelemetry nicht vorhanden

## 8. Dashboard Integration Audit

**Dashboard Readiness:** `Partially Functional`

| Aspekt | Status | Details |
|---|---|---|
| API Endpoints | ✅ | `dor-bot`: `/api/`, `/kpi/`, `/health` |
| Real-Time Data | ⚠️ | Polling, kein WebSocket |
| Trade History | ✅ | aus `memory.json` |
| Signal Visualization | ⚠️ | Proxies aus `memory.json`, nicht aus `bot/` |
| Health Monitoring | ⚠️ | Adapter-Health leer |

**Kritischer Befund:** Dashboard-Daten stammen fast ausschließlich aus `dor-bot`.  
Die `bot/` TypeScript-Pipeline liefert derzeit keine Daten ans Dashboard.

## 9. Runtime Safety Audit

**Runtime Safety Score:** `5 / 10`

| Mechanismus | Status | Details |
|---|---|---|
| Circuit Breaker | ✅ | 5 Fehler → Open |
| Kill Switch | ⚠️ | Nur `dor-bot` hat `sell_all` |
| Max Trade Limits | ✅ | `guardrails.yaml` vorhanden |
| Position Limits | ⚠️ | Deklariert, nicht stark erzwungen |
| Error Recovery | ⚠️ | Kein globaler Recovery-Handler |
| Dry-Run Default | ✅ | default true |
| LIVE_TRADING Gate | ✅ | explizit erforderlich |
| RPC Policy Gate | ✅ | `LIVE_TRADING` erfordert `RPC_MODE=real` |

**Fehlende Safeguards:**

- kein zentraler Kill-Switch für `bot/`
- keine explizite Max-Daily-Loss-Enforcement
- keine globale Fehler-Eskalation
- keine automatische Recovery nach Breaker

## 10. Persistence Layer Audit

**Persistence Status:** `Partially Implemented`

| Datentyp | `bot/` | `dor-bot` |
|---|---|---|
| Trades | Optional JournalWriter | `memory.json` |
| Signals | In-Memory | - |
| Logs | InMemoryActionLogger | `log_lines` in-memory |
| Bot State | - | `memory.json`, `positions.json` |
| Decisions | - | `decision_store` SQLite |
| Metrics | - | `metrics_snapshot` SQLite |
| Adapter Health | - | vorhanden, aber nicht beschrieben |

**Fazit:** `bot/` ist größtenteils in-memory; `dor-bot` nutzt ein getrenntes Persistenzmodell.

## 11. Test Coverage Audit

**Test Coverage Rating:** `Good (~7 / 10)`

- Adapter Tests vorhanden
- Risk Tests vorhanden
- Chaos Tests vorhanden
- Golden Tasks vorhanden
- Determinism Tests vorhanden
- echte E2E-Tests fehlen

## 12. Production Readiness Score

| Category | Score | Notes |
|---|---:|---|
| Architecture | 8 | gute Pipeline-Struktur |
| Data Reliability | 5 | kein 5xx-Retry, kein Fallback |
| Execution Safety | 2 | kein realer Swap |
| Risk Layer | 6 | Chaos teilweise real |
| RPC Verification | 6 | Real-Client vorhanden, Default Stub |
| Observability | 4 | keine Persistenz / Bridge |
| Dashboard | 5 | dor-bot-Daten, keine bot-Integration |
| Persistence | 4 | verteilt, teils in-memory |
| Testing | 7 | keine E2E |
| Runtime Safety | 5 | kein bot-Kill-Switch |

**Gesamt-Readiness:** `4.2 / 10` → **Nicht bereit für Live-Test**

## 13. Blocking Issues

- Execution Adapter Stub
- MEV / Sandwich Szenario Stub
- kein 5xx-Retry
- keine `bot/ → dashboard`-Anbindung
- keine persistenten Action / Decision Logs
- RPC Default Stub
- `record_adapter_status` nie aufgerufen
- kein Kill-Switch für `bot/`

## 14. Remediation Plan

### Phase 1 — Kritisch

| # | File | Change | Expected Behavior |
|---|---|---|---|
| 1.1 | `bot/src/adapters/http-resilience.ts` | Retry bei 5xx | bis zu 3 Retries mit Backoff |
| 1.2 | `bot/src/adapters/dex-execution/swap.ts` | Jupiter Lite API Integration | echter Swap bei Live |
| 1.3 | `bot/src/core/config/rpc.ts` | Doku / Enforce | `RPC_MODE=real` für Live |
| 1.4 | `bot/server/` | Minimaler Server | `/health`, `/kpi/summary`, `/kpi/decisions` |
| 1.5 | `bot/src/observability/action-log.ts` | FileSystemActionLogger | JSONL-Log |
| 1.6 | `bot/src/core/engine.ts`, `orchestrator.ts` | persistentes Journal | Journal dauerhaft speichern |

### Phase 2 — Stabilität

| # | File | Change | Expected Behavior |
|---|---|---|---|
| 2.1 | `bot/src/chaos/chaos-suite.ts` | Szenario 15 | echte MEV-Detection |
| 2.2 | `bot/src/chaos/chaos-suite.ts` | Szenarien 1–6 | grundlegende Abdeckung |
| 2.3 | `bot/src/adapters/adapters-with-cb.ts` | Health-Callback | Adapter-Health sichtbar |
| 2.4 | `bot/src/adapters/rpc-verify/` | RPC Failover | Secondary RPC |
| 2.5 | `bot/src/adapters/` | Fallback-Cache | 60s TTL bei Fail |

### Phase 3 — Observability

| # | File | Change | Expected Behavior |
|---|---|---|---|
| 3.1 | `bot/src/observability/metrics.ts` | persistente Metriken | JSON / DB / Prometheus |
| 3.2 | `bot/server/` | `/kpi/adapters` | Adapter-Health exportiert |
| 3.3 | `bot/src/governance/` | Kill-Switch API | `/bot/emergency-stop` |
| 3.4 | Dashboard | Anpassung | nutzt bot-KPIs wenn verfügbar |

## 15. Live Test Procedure (wenn Phase 1 abgeschlossen)

### Voraussetzungen

- Phase 1 abgeschlossen
- `RPC_MODE=real`
- `RPC_URL` gesetzt
- `LIVE_TRADING=true` nur für Test
- limitierte Testsumme, z. B. `0.01 SOL`

### Schritte

1. Dry-Run-Validierung
2. Kleinkapital-Test
3. Dashboard-Monitoring
4. Rollback
5. Kill-Switch-Bedingungen anwenden

## Zusammenfassung

BobbyExecution ist derzeit **nicht bereit** für einen kontrollierten Live-Test mit dem Browser-Dashboard.

Hauptursachen:

- kein realer Swap
- keine Integration der `bot/`-Pipeline mit dem Dashboard
- fehlende Persistenz von Actions / Decisions
- unvollständige Chaos-Suite
- kein 5xx-Retry und kein Fallback-Cache
- kein Kill-Switch für die `bot/`-Pipeline

Nach Umsetzung von Phase 1 und den zentralen Punkten aus Phase 2 wäre ein sehr vorsichtiger Live-Test mit geringem Kapital und klarem Monitoring / Rollback planbar.

---

## Authority / Related Docs

- Canonical governance: [`governance/SoT.md`](../../governance/SoT.md)
- Production readiness checklist: [`production_readiness_checklist.md`](production_readiness_checklist.md)
- Incident and kill-switch runbook: [`incident_and_killswitch_runbook.md`](incident_and_killswitch_runbook.md)
- Trading chaos scenarios: [`docs/trading/trading-edge_chaos-scenarios.md`](../trading/trading-edge_chaos-scenarios.md)
- Domain index: [`docs/bobbyexecution/README.md`](README.md)
