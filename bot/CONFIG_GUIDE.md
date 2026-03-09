################################################################################
# BobbyExecution Configuration Guide
# Comprehensive setup for development, testing, and production environments
################################################################################

## 1. Environment Configuration (.env)

All configuration is managed via environment variables loaded in `bot/src/config/`.

### Safety Modes

- **DRY_TRADING** (Default: true)
  ```
  LIVE_TRADING=false DRY_RUN=true
  → Simulated trades, no wallet balance risk
  ```

- **PAPER_TRADING** (Testing)
  ```
  LIVE_TRADING=false DRY_RUN=false
  → Real price data, simulated execution
  ```

- **LIVE_TRADING** (Production Only)
  ```
  LIVE_TRADING=true RPC_MODE=real RPC_URL=<real-endpoint>
  → FAIL-CLOSED: Requires RPC_MODE=real or startup fails
  ```

### RPC Selection

- **Stub Mode** (Development, tests fully offline)
  ```
  RPC_MODE=stub
  ```

- **Real Mode** (Live chain, requires RPC_URL)
  ```
  RPC_MODE=real
  RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
  ```

---

## 2. Governance Files

All governance rules are in `bot/src/config/`:

### guardrails.yaml
Risk limits and trading constraints:
```yaml
maxPositionSizePercent: 10        # Max % of wallet per trade
maxDailyLossPercent: 5            # Daily loss limit before auto-halt
maxTradesPerMinute: 6             # Rate limit
maxSlippagePercent: 5             # Swap slippage tolerance
reviewGateThresholdUsd: 10000     # Amount requiring human review

allowlistMints: []                # Whitelist tokens (empty = all)
denylistMints: []                 # Blacklist scam/honeypot tokens

circuitBreaker:
  failureThreshold: 5             # Open after N consecutive failures
  recoveryTimeMs: 60000           # Retry after 60s
```

**For Production:**
- Increase `maxDailyLossPercent` conservatively (2-3%)
- Add known scam tokens to `denylistMints`
- Use `allowlistMints` to restrict to vetted tokens

### agents.yaml
Role-based permissions (executor, monitor, etc.):
```yaml
executor:
  permissions: [market.read, wallet.read, trade.execute, ...]
  reviewPolicy:
    mode: required                # required | draft_only | none
    requiresHumanFor: [trade.execute]
    reviewerRoles: [senior, admin]
```

### permissions.yaml
Tool-to-permission mapping (auto-loaded):
```yaml
trade.dex.executeSwap: trade.execute
wallet.moralis.getBalances: wallet.read
...
```

---

## 3. Deployment Environments

### Development (Local)
```bash
NODE_ENV=development
LIVE_TRADING=false
DRY_RUN=true
RPC_MODE=stub
TRADING_ENABLED=false
```

### Testing (CI/CD)
```bash
NODE_ENV=test
REPLAY_MODE=true
RPC_MODE=stub
TRADING_ENABLED=false
```

### Staging (Pre-Production)
```bash
NODE_ENV=production
LIVE_TRADING=false
DRY_RUN=false
RPC_MODE=real
RPC_URL=https://mainnet.helius-rpc.com/?api-key=STAGING_KEY
TRADING_ENABLED=true
REVIEW_POLICY_MODE=required
```

### Production (Live Trading)
```bash
NODE_ENV=production
LIVE_TRADING=true
RPC_MODE=real
RPC_URL=https://mainnet.helius-rpc.com/?api-key=PROD_KEY
TRADING_ENABLED=true
REVIEW_POLICY_MODE=required
WALLET_ADDRESS=YOUR_PROD_WALLET
```

---

## 4. Production Readiness Checklist

- [ ] All secrets in `.env` (NOT in git)
- [ ] `RPC_MODE=real` + valid `RPC_URL`
- [ ] `LIVE_TRADING=true` only if `RPC_MODE=real`
- [ ] `WALLET_ADDRESS` set and verified
- [ ] `maxDailyLossPercent` set conservatively
- [ ] `denylistMints` includes known scams
- [ ] `REVIEW_POLICY_MODE=required` for critical trades
- [ ] Circuit breaker configured
- [ ] `npm run premerge` passing (lint + tests + chaos gate)
- [ ] `.env` file ignored in `.gitignore`
- [ ] Database/journal backed up
- [ ] Monitoring & alerting configured

---

## 5. Configuration Priority Order

1. **Environment Variables** (highest priority)
2. **YAML Files** (guardrails.yaml, agents.yaml)
3. **Defaults** (hardcoded in config-schema.ts)

---

## References

- Config Schema: `bot/src/config/config-schema.ts`
- Config Loader: `bot/src/config/load-config.ts`
- Safety Checks: `bot/src/config/safety.ts`
- Guardrails Policy: `bot/src/governance/guardrails.ts`
