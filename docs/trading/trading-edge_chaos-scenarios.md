# Trading-Edge Chaos Scenarios — Solana Meme Coins

> **Role:** Supporting deep-reference layer. This document describes manipulation patterns and fail-closed decision examples.
> It is **not** the canonical governance file.
>
> **Canonical governance:** [`governance/SoT.md §12`](../../governance/SoT.md)
> **Risk governance protocol:** [`docs/bobbyexecution/risk_and_chaos_governance.md`](../bobbyexecution/risk_and_chaos_governance.md)
> **Audit report:** [`docs/bobbyexecution/production_readiness_audit_report.md`](../bobbyexecution/production_readiness_audit_report.md)

---

### 8 Trading-Edge Chaos-Scenarios in Solana Meme Coins (Category 5: High-Risk Manipulation Patterns)

Using Moralis Solana API endpoints (e.g., Get Token Holders, Get Token Swaps, Get Pairs & Liquidity, Get Token Analytics) as the onchain research layer, these scenarios highlight extreme volatility and manipulation risks in Solana meme coins. Each is grounded in real data patterns from sources like Solidus Labs reports (98.7% Pump.fun tokens as pump-dumps/rugs) and arXiv studies (82.8% high-performing meme coins manipulated). Moralis enables detection via holder changes, swap history, liquidity monitoring, and transaction patterns—always with fail-closed if data incomplete (<70% completeness).

1. **Rug Pulls**: Scammers seed liquidity, attract buyers, then drain pools (93% Raydium pools show soft rug traits per Solidus). Edge: Monitor Moralis Get Pairs & Liquidity for sudden reserve drops; fail-closed if liquidity < $50k or discrepancy >20%.
   
2. **Pump and Dumps**: Artificially inflate price via coordinated buys, then mass sell (98.6% Pump.fun tokens collapse). Edge: Use Moralis Get Token Swaps for velocity spikes without holder growth; abort if BCI <35 (cluster concentration).

3. **Sandwich Attacks (MEV)**: Bots front-run and back-run user tx for profit extraction (~$600k extracted since Jan 2024 per Medium analysis). Edge: Moralis Get Token Transactions to scan for bundled tx around user swaps; block tx if timing_anomaly_score >60.

4. **Wash Trading**: Fake volume through self-trades (62.9% manipulated coins per arXiv). Edge: Moralis Get Volume Stats vs. Get Token Holders—flag if volume/holders ratio >50 without organic swaps; degraded mode if cross_source_confidence <80.

5. **Liquidity Pool-Based Price Inflation (LPI)**: Minimal buys trigger outsized pumps (82.8% manipulated per arXiv). Edge: Moralis Get Token Analytics for price_change_24h vs. liquidity; abort if price_change >300% with liquidity < $100k.

6. **Oracle Manipulation**: Feed bad data to DeFi-integrated memes causing mispriced liquidations (Certik report on rising attacks). Edge: Cross-check Moralis Get Token Price with external oracles; fail-closed on discrepancy_rate >15%.

7. **Liquidation Cascades**: Leverage in meme-perps leads to chain reactions (tied to oracle manip). Edge: Moralis Get Token Swaps for cascade patterns in high-leverage tokens; tx block if Final_Risk >80.

8. **Sniper/Bot Front-Running**: Early block buys by bots (e.g., 26k SOL extracted per Medium). Edge: Moralis Get Token Holders historical for sniper_risk_score; immediate abort if >40 in first 10 blocks.

These scenarios emphasize "lieber nichts tun als alles verlieren"—use Moralis for real-time checks, but always fail-closed on incomplete data to avoid false positives.

### Typische Fail-Closed-Entscheidungen (Beispiele)

Fail-closed bedeutet: Bei Unsicherheit oder Risiko-Schwelle, sofort abbrechen (kein Trade, kein Tx, degraded mode). Basierend auf Moralis-Daten und Engine-Formeln (z.B. BCI/MCI <45 → neutral fallback).

- **Vault 503 → sofort abort**: Wenn Moralis API rate-limit/error (HTTP 503), abort entire tx flow; log "API vault breach—onchain unverifiable" in team_findings.

- **BCI < 35 → tx block**: Bei low cluster_diversity_index (Sybil risk), block transaction; reason: "Potential dev-bot cluster detected via Moralis holders distribution."

- **Discrepancy_rate > 20% → degraded mode**: Moralis Get Token Price vs. DexScreener delta high—switch to low_confidence, no strong claims; log "Cross-source anomaly—possible oracle manip."

- **Holder_change_1h >50% drop → rug alert abort**: Moralis Get Token Holders shows mass exit; fail-closed tx, notify "Rug pattern via holder velocity."

- **Incomplete Moralis response (missing tx/graph) → BCI=45 fallback**: No full data—assume neutral risk, but block high-value tx; log "Fail-closed on partial onchain intel."

### Was niemals erlaubt ist (Hard Constraints)

- **Hard Shill**: Kein "Buy now!" oder "This will moon"—auch nicht implizit. Stattdessen: "Risiko hoch per Moralis MCI=32."

- **Preisvorhersagen**: Kein "100x potential" oder Targets. Immer: "No predictions—based on current Moralis volume stats only."

- **Statische Secrets**: Kein Hardcode von API-Keys/Wallets in Logs/Responses. Use env vars; fail-closed on exposure.

- **Silent Writes**: Kein unlogged Tx oder State-Change. Always log to team_findings before/after; abort if log fails.

- **Ignore Vaults**: Bei Moralis error (e.g. 429 rate limit), kein Bypass—immediate abort, no retry without human override.

### Few-Shot-Beispiele

**Input 1 (Korrekte Antwort - Fail-Closed + Log)**: "Trade this new Pump.fun token: CA=XYZ, looks pumping!"
   - **Korrekte Antwort**: "Moralis Get Token Holders shows BCI=28 (high sybil_cluster_risk). Fail-closed: Tx blocked. No trade advised due to potential rug pattern."
   - **Log in team_findings**: "User input CA=XYZ; MCI=45 (fallback incomplete); discrepancy_rate=22%>20% → degraded mode; aborted for safety."

**Input 2 (Falsche Antwort - Warum falsch)**: "Trade this new Pump.fun token: CA=XYZ, looks pumping!"
   - **Falsche Antwort**: "Great opportunity! Buy now, could 10x based on volume."
   - **Warum falsch**: Ignoriert fail-closed (no Moralis check for BCI/MCI); hard shill + Preisvorhersage verboten; kein Log—verletzt "lieber nichts tun" Haltung, riskiert Verluste ohne Onchain-Verifizierung.

**Input 3 (Korrekte Antwort)**: "Check liquidity for CA=ABC."
   - **Korrekte Antwort**: "Moralis Get Pairs & Liquidity: $120k, but holder_change_1h=-35% (rug risk). Fail-closed: No further action without more data."
   - **Log**: "CA=ABC query; Final_Risk=72>80 → suppressed; cross_source_confidence=85."

**Input 4 (Falsche Antwort)**: "Check liquidity for CA=ABC."
   - **Falsche Antwort**: "Liquidity solid, go all in!"
   - **Warum falsch**: Kein Moralis-basiertes Risiko-Assessment; ignoriert Chaos-Scenarios wie LPI; silent (no log)—verstößt gegen defensive Thinking, könnte Cascade auslösen.

**Input 5 (Korrekte)**: "Suspicious tx bundle on CA=DEF."
   - **Korrekte**: "Moralis Get Token Transactions flags timing_anomaly_score=65>60. Fail-closed: Bundle detected, potential MEV—tx aborted."
   - **Log**: "CA=DEF; BCI=32<35 → block; team alert for manual review."

**Input 6 (Falsche)**: "Suspicious tx bundle on CA=DEF."
   - **Falsche**: "Ignore the bundle, still good entry."
   - **Warum falsch**: Bypass von fail-closed Schwelle; no Moralis evidence citation; riskiert Sandwich-Attack—nicht defensiv, verliert "alles verlieren"-Prävention.

---

## Authority / Related Docs

- Canonical governance (chaos safety): [`governance/SoT.md §12`](../../governance/SoT.md)
- Risk and chaos governance protocol: [`docs/bobbyexecution/risk_and_chaos_governance.md`](../bobbyexecution/risk_and_chaos_governance.md)
- Production readiness audit: [`docs/bobbyexecution/production_readiness_audit_report.md`](../bobbyexecution/production_readiness_audit_report.md)
- Domain index: [`docs/bobbyexecution/README.md`](../bobbyexecution/README.md)