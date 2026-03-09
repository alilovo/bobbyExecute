################################################################################
# BobbyExecution Deployment: Vercel vs. Render
# Analysis: hosting options, costs, and recommendations
################################################################################

## TL;DR RECOMMENDATION

**Vercel Dashboard + Render Bot API**

- **Dashboard:** Vercel (free + pay-as-you-go)
- **Bot API:** Render (Starter $7/month or Professional $12/month)
- **Total:** $7-12/month minimum + variable costs
- **Best for:** Cost-conscious, automated deployments, easy scaling

---

## Option 1: VERCEL (Dashboard + API)

### Pros
✅ Free tier generous for frontends  
✅ Git-integrated deployments  
✅ Zero cold starts (serverless edge)  
✅ Automatic SSL/HTTPS  
✅ Environment variables UI  

### Cons
❌ API is serverless (can be stateless only)  
❌ Long-running processes not suited  
❌ Expensive for persistent connections  
❌ 10s timeout on hobby tier  
❌ WebSocket support limited  

### Cost (Bot API on Vercel Functions)
```
Free Tier:
- 100 GB bandwidth/month
- 1000 function invocations/month
- Max 10s execution time

Pro Tier ($20/month):
- Unlimited functions
- 50ms cold start (vs 200ms hobby)
- Still 10s timeout (problematic for polling)
```

### Not Recommended For
- Bot API (needs persistent server, long-running tasks)
- Polling endpoints (2s/10s intervals)
- State management (in-memory circuits, journals)

---

## Option 2: RENDER (Preferred for Bot API)

### Pros
✅ Perfect for Always-On services  
✅ Persistent server process  
✅ No cold starts after deployment  
✅ Easy PostgreSQL attachment  
✅ Pay-as-you-go or fixed pricing  
✅ Git-integrated CI/CD  
✅ Environment variables managed UI  

### Cons
❌ Minimum $7/month (vs Vercel free)  
❌ Sleeps free tier after 15m inactivity  
❌ Can be slower than Vercel for API responses initially  

### Cost Analysis (Trading Bot API)

#### Starter Plan ($7/month)
```
- 0.5 GB RAM, 0.5 vCPU
- ~10 req/s capacity
- Free tier: sleeps after 15m inactivity

SUITABLE FOR: Development, staging, low-traffic testing
Monthly Cost: $7
```

#### Standard Plan ($12/month)
```
- 0.5 GB RAM, 0.5 vCPU
- Always-on (no sleeping)
- ~20 req/s capacity

SUITABLE FOR: Production trading bot (low-medium volume)
Monthly Cost: $12
```

#### Professional Plan ($25/month)
```
- 1 GB RAM, 1 vCPU
- Always-on
- ~50 req/s capacity

SUITABLE FOR: High-frequency trading, multiple bots
Monthly Cost: $25
```

### Estimated Bot API Runtime

**Typical Trading Bot Load:**
```
- Dashboard polling: 2s (health) + 10s (KPIs) = 12 requests/minute
- Memory footprint: ~150-300 MB (circuits, state, journal cache)
- CPU: ~5-15% average (JSON parsing, governance checks)
- Burst: ~30 req/s during market events
```

**Recommendation:**
- **Development:** Free tier (Starter, sleep OK)
- **Production:** Standard ($12/month) or Professional ($25/month)

**Monthly Cost Estimation:**
```
Render Bot API:           $12-25/month
Vercel Dashboard:         $0-5/month (free + bandwidth)
PostgreSQL add-on:        $0-15/month (optional)
RPC Provider (Helius):    $15-100/month (depends on requests)

TOTAL: $27-145/month depending on scale
```

---

## Option 3: RAILWAY (Alternative)

### Cost
```
Usage-based, similar to Vercel Functions
- $0.0000417 per vCPU-second
- $0.000000231 per GB-second

For a trading bot running 24/7:
- vCPU-hours: 24 × 0.5 = 12 vCPU-hours
- Cost: 12 × 3600s × $0.0000417 = ~$18/month
- RAM (300MB): 24 × 3600s × 0.3 GB × $0.000000231 = ~$6/month
TOTAL: ~$24/month + bandwidth
```

### Verdict
- Similar to Render Standard ($12/month)
- More complex billing calculation
- ✅ Use if you prefer Railway's UX

---

## Recommended Stack

```
┌─────────────────────────────────────────────┐
│  BobbyExecution Deployment Architecture    │
├─────────────────────────────────────────────┤
│                                             │
│  Dashboard (Vercel)                         │
│  ├─ Next.js App                             │
│  ├─ Static export (.next)                   │
│  └─ Cost: FREE (or ~$5/mo for pro)         │
│                                             │
│  Bot API (Render)                           │
│  ├─ Node.js Fastify server                  │
│  ├─ Standard plan ($12/mo)                  │
│  ├─ Always-on, no cold starts               │
│  └─ Persistent state (circuits, journal)    │
│                                             │
│  Database (optional)                        │
│  ├─ Render PostgreSQL (~$15/mo)             │
│  ├─ OR SQLite in-memory                     │
│  └─ For journal persistence                 │
│                                             │
│  RPC Provider (Helius)                      │
│  ├─ Usage-based ($15-100/mo)                │
│  ├─ OR Alchemy / Quicknode                  │
│  └─ Solana mainnet endpoint                 │
│                                             │
└─────────────────────────────────────────────┘

TOTAL MONTHLY: $27-42
(assuming moderate RPC usage)
```

---

## Deployment Steps

### Dashboard on Vercel

1. **Connect GitHub:**
   ```
   Vercel → New Project → Select bobbyExecute repo
   Root Directory: dashboard
   ```

2. **Set Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL = https://bot-api-xxxxx.onrender.com:3333
   NEXT_PUBLIC_USE_MOCK = false
   NEXT_PUBLIC_ENV = LIVE
   ```

3. **Deploy:**
   ```
   git push → Auto-deploy on main
   ```

### Bot API on Render

1. **Create Service:**
   ```
   New + Web Service → Connect GitHub
   Repository: bobbyExecute
   Root Directory: (leave empty)
   Build Command: cd bot && npm install && npm run build
   Start Command: cd bot && npm start
   ```

2. **Set Environment Variables:**
   ```
   NODE_ENV = production
   LIVE_TRADING = false (start in paper mode)
   RPC_MODE = real
   RPC_URL = https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   TRADING_ENABLED = true
   REVIEW_POLICY_MODE = required
   PORT = 3333
   ```

3. **Deploy:**
   ```
   git push → Auto-deploy on main
   ```

4. **Verify:**
   ```
   curl https://bot-api-xxxxx.onrender.com:3333/health
   ```

---

## Cost Comparison Table

| Component | Vercel | Render | Railway | AWS |
|-----------|--------|--------|---------|-----|
| **Dashboard** | FREE | $12/mo | ~$20/mo | $50+/mo |
| **Bot API** | $15-50/mo* | $12/mo | ~$24/mo | $30+/mo |
| **Database** | $0 | $0-15/mo | $0-15/mo | $50+/mo |
| **RPC (Helius)** | $15-100/mo | $15-100/mo | $15-100/mo | $15-100/mo |
| **TOTAL** | $30-150/mo | $27-127/mo | $50-159/mo | $145+/mo |

*Vercel Functions unsuitable for persistent trading bot

---

## Final Recommendation

### For Governance-First Trading Bot

**USE: Vercel Dashboard + Render Bot API**

- ✅ Dashboard: FREE or $5/mo (static export)
- ✅ Bot API: $12/mo (Standard, always-on)
- ✅ Simple setup, git-driven CI/CD
- ✅ Scales easily (upgrade plan as needed)
- ✅ Strong governance + monitoring
- ✅ Production-ready for regulatory compliance

**NOT Recommended:**
- ❌ Vercel for Bot API (stateless, cold starts, timeouts)
- ❌ Free tier Render (sleeps after 15m, risk for trading)

---

## Next Steps

1. Create Render account: https://render.com
2. Connect GitHub repo
3. Set environment variables (see CONFIG_GUIDE.md)
4. Deploy Bot API to Render
5. Deploy Dashboard to Vercel
6. Test: `curl https://api-url/health` → Dashboard should show LIVE
7. Monitor: Render/Vercel dashboards + error logs
8. Scale: Upgrade Render plan if needed
