################################################################################
# Render Deployment Guide - BobbyExecution Bot API
# Step-by-step instructions for deploying the trading bot to Render
################################################################################

## Prerequisites

1. GitHub account with bobbyExecute repo pushed
2. Render account (https://render.com)
3. Solana RPC API key (Helius recommended)
4. Environment variables ready (see CONFIG_GUIDE.md)

---

## Step 1: Create Render Service

1. Go to **https://dashboard.render.com**
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect account"** (GitHub)
4. Select **bobbyExecute** repository
5. Click **"Connect"**

---

## Step 2: Configure Build & Deploy

Fill in the service configuration:

| Setting | Value |
|---------|-------|
| **Name** | `bobby-bot-api` (or your choice) |
| **Root Directory** | (leave empty) |
| **Environment** | `Node` |
| **Region** | `Frankfurt` (or closest to you) |
| **Branch** | `main` |
| **Build Command** | `cd bot && npm install && npm run build` |
| **Start Command** | `cd bot && npm start` |

Click **"Create Web Service"**

---

## Step 3: Set Environment Variables

After service is created, go to **Settings** → **Environment**

Add each variable:

```
NODE_ENV                        = production
LIVE_TRADING                    = false
TRADING_ENABLED                 = true
DRY_RUN                         = false
RPC_MODE                        = real
RPC_URL                         = https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
REPLAY_MODE                     = false
PORT                            = 3333
HOST                            = 0.0.0.0
REVIEW_POLICY_MODE              = required
MAX_SLIPPAGE_PERCENT            = 5
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
CIRCUIT_BREAKER_RECOVERY_MS     = 60000
```

### Get RPC API Key

Visit https://www.helius.dev/ (Recommended):
1. Sign up free account
2. Create project
3. Copy API key
4. RPC URL: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`

---

## Step 4: Deploy

1. Click **"Deploy"** button (Render auto-deploys on git push)
2. Wait for build to complete (~2-5 minutes)
3. Check logs in **"Logs"** tab

Expected output:
```
> bot@1.0.0 start
> next start (or node src/server/run.ts)

[Server] Listening on http://0.0.0.0:3333
[Health] System ready
```

---

## Step 5: Verify Deployment

Once deployed, Render assigns a public URL like:
```
https://bobby-bot-api-xxxxx.onrender.com
```

Test the health endpoint:

```bash
curl https://bobby-bot-api-xxxxx.onrender.com:3333/health
```

Expected response:
```json
{
  "status": "OK",
  "uptimeMs": 123456,
  "version": "0.1.0",
  "killSwitch": { "halted": false }
}
```

---

## Step 6: Update Dashboard Environment

In Vercel Dashboard project settings:

1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL`:
   ```
   NEXT_PUBLIC_API_URL = https://bobby-bot-api-xxxxx.onrender.com:3333
   ```
3. Set `NEXT_PUBLIC_USE_MOCK = false`
4. Redeploy dashboard (or git push)

---

## Step 7: Monitor Deployment

### Render Monitoring

- **Logs:** Real-time logs in Render dashboard
- **Metrics:** CPU, memory, request count
- **Alerts:** Email on deploy failure or errors

### Test Endpoints

```bash
# Health
curl https://bobby-bot-api-xxxxx.onrender.com:3333/health

# KPI Summary
curl https://bobby-bot-api-xxxxx.onrender.com:3333/kpi/summary

# Adapters
curl https://bobby-bot-api-xxxxx.onrender.com:3333/kpi/adapters

# Decisions (last 50)
curl https://bobby-bot-api-xxxxx.onrender.com:3333/kpi/decisions?limit=50
```

---

## Step 8: Configure Auto-Deploy

Render automatically deploys when you push to `main`:

1. Ensure **"Auto-deploy"** is enabled in Render settings
2. Push changes to GitHub:
   ```bash
   git push origin main
   ```
3. Render triggers build & deploy automatically

---

## Step 9: Setup Database (Optional)

If you want persistent journal storage:

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name: `bobby-db`
3. Copy connection string
4. In bot service, add environment variable:
   ```
   DATABASE_URL = <connection-string-from-above>
   ```
5. Restart service

---

## Cost Breakdown (Monthly)

### Render Pricing

| Plan | RAM | vCPU | Cost | Auto-Sleep |
|------|-----|------|------|-----------|
| **Starter** | 0.5 GB | 0.5 | $7 | Yes (15m) |
| **Standard** | 0.5 GB | 0.5 | $12 | No |
| **Professional** | 1 GB | 1 | $25 | No |

### Recommendation

For production trading bot → **Standard ($12/month)** minimum.
- Always-on (no sleep interruptions)
- Sufficient CPU/RAM for governance checks
- Can handle ~20 req/s

### Total Cost (with addons)

```
Render Standard Bot API:  $12/month
Render PostgreSQL (opt):  $15/month
RPC Provider (Helius):    $15-100/month (usage-based)
Dashboard on Vercel:      $0 (free) or $5 (pro)
─────────────────────────────────
TOTAL:                    $27-132/month
```

---

## Troubleshooting

### Build Fails

Check logs for:
- Node version (must be 22, enforced by `.nvmrc`)
- Dependencies: `npm install` error
- TypeScript: `npm run build` error

**Fix:** Push with detailed commit message:
```bash
git push origin main  # Render will rebuild
```

### Service Won't Start

Check environment variables:
```bash
# These are REQUIRED:
✓ RPC_MODE=real
✓ RPC_URL=https://...
✓ NODE_ENV=production
```

### Health Endpoint Returns ERROR

Check:
1. RPC URL is valid and accessible
2. Circuit breaker not open (check logs)
3. Adapters responding (try `/kpi/adapters`)

### Cold Start / Slow Response

- Starter plan sleeps after 15 min → upgrade to Standard
- First request after wake = ~3-5s delay
- Subsequent requests = <200ms

---

## Next Steps

1. **Verify deployment:** Hit `/health` endpoint
2. **Update dashboard:** Set `NEXT_PUBLIC_API_URL`
3. **Test end-to-end:** Dashboard → Bot API → Render logs
4. **Monitor:** Set up alerts in Render
5. **Scale:** Upgrade plan as needed

---

## Support

- Render docs: https://render.com/docs
- Node.js deployment: https://render.com/docs/deploy-node
- PostgreSQL: https://render.com/docs/databases

---

## Security Checklist

- [ ] Never commit `.env` file (use Render UI only)
- [ ] RPC API key in Render env (NOT in git)
- [ ] `LIVE_TRADING=false` initially (paper mode)
- [ ] Verify bot connects to correct RPC on first run
- [ ] Test kill switch before enabling live trading
- [ ] Enable monitoring & alerts
