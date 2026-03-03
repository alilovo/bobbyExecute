"""
bot.py – BOOBY BOT v30 | ELITE SOLANA SCALPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW in v30:
  • Q-Learning adaptive threshold (Reinforcement Learning)
  • Kelly Criterion fractional position sizing
  • ATR-based dynamic stop losses + tightening trail
  • 3 strategies: pumpfun / momentum / mean_reversion
  • Anti-Rug: top10%, liq/MC, mint/freeze, 1s-rug, wash-vol block
  • Emergency stop -15% | Loss-streak pause
  • Telegram alerts on BUY/SELL/streak
  • Full async, <100ms latency target
"""

import asyncio, json, logging, math, os, random, time
from collections import deque
from datetime import datetime
from typing import Optional
import aiohttp

log = logging.getLogger("bot")

DEFAULT_CFG = {
    "rpc_url": "https://mainnet.helius-rpc.com/?api-key=YOURKEY",
    "helius_api_key": "YOURKEY",
    "jupiter_api": "https://lite-api.jup.ag/swap/v1",
    "wallet_file": "wallet.json",
    "memory_file": "memory.json",
    "positions_file": "positions.json",
    "min_trade_sol": 0.045,
    "max_trade_sol": 0.10,
    "max_open_positions": 5,
    "priority_fee_lamports": 80000,
    "pf_profit": 0.15, "pf_stop": -0.03, "pf_max_hold": 3, "pf_min_score": 62,
    "mo_profit": 0.15, "mo_stop": -0.015, "mo_max_hold": 3, "mo_min_score": 62,
    "scan_interval_sec": 2,
    "dry_run": False,
    "loss_streak_pause_min": 20, "loss_streak_limit": 5,
    "min_wallet_sol": 0.14,
    "stop_loss_cooldown_min": 15,
    "min_liq_buy": 3000, "min_mc_buy": 30000,
    "emergency_stop_pct": -0.15,
    "rug_1s_threshold": -0.10,
    "top10_rug_block_pct": 85,
    "ql_alpha": 0.10, "ql_gamma": 0.90, "ql_epsilon": 0.15,
    "atr_period": 14,
    "kelly_fraction": 0.25,
    "telegram_token": "", "telegram_chat_id": "",
}

SOL_MINT = "So11111111111111111111111111111111111111112"


def now_ts(): return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def safe_float(v, d=0.0):
    try:
        f = float(v or 0)
        return f if math.isfinite(f) else d
    except: return d

def read_json(path, default=None):
    try:
        if os.path.exists(path): return json.load(open(path, encoding="utf-8"))
    except: pass
    return default if default is not None else {}

def write_json(path, data):
    try:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        os.replace(tmp, path)
    except Exception as e: log.error(f"write_json {path}: {e}")


class QLearningAgent:
    """
    Reinforcement Learning agent that adapts the signal threshold.
    State  = (win_rate_bin 0-9, loss_streak 0-5, trend 3char)
    Action = threshold delta: [-5, 0, +5]
    Reward = 2*(win_rate - 0.5) - 0.5 if streak >= 3
    """
    ACTIONS = [-5, 0, +5]

    def __init__(self, alpha=0.1, gamma=0.9, epsilon=0.15):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.q = {}

    def _s(self, wr, streak, trend):
        return (min(int(wr * 10), 9), min(streak, 5), (trend or "neu")[:3])

    def select_action(self, wr, streak, trend):
        s = self._s(wr, streak, trend)
        if random.random() < self.epsilon:
            return random.choice(self.ACTIONS)
        return max(self.ACTIONS, key=lambda a: self.q.get((s, a), 0.0))

    def update(self, wr, streak, trend, action, reward, wr2, streak2, trend2):
        s = self._s(wr, streak, trend)
        s2 = self._s(wr2, streak2, trend2)
        old = self.q.get((s, action), 0.0)
        best = max(self.q.get((s2, a), 0.0) for a in self.ACTIONS)
        self.q[(s, action)] = old + self.alpha * (reward + self.gamma * best - old)

    def to_dict(self): return {str(k): v for k, v in self.q.items()}

    def from_dict(self, d):
        import ast
        self.q = {}
        for k, v in d.items():
            try: self.q[ast.literal_eval(k)] = float(v)
            except: pass


class ATRCalc:
    """Normalized Average True Range for dynamic stop sizing."""
    def __init__(self, period=14):
        self.period = period
        self.closes = deque(maxlen=period + 1)
        self.highs = deque(maxlen=period + 1)
        self.lows = deque(maxlen=period + 1)

    def add(self, hi, lo, cl):
        self.highs.append(hi); self.lows.append(lo); self.closes.append(cl)

    def get_atr(self):
        if len(self.closes) < 2: return 0.025
        cl, hi, lo = list(self.closes), list(self.highs), list(self.lows)
        trs = [max(hi[i]-lo[i], abs(hi[i]-cl[i-1]), abs(lo[i]-cl[i-1])) / (cl[i-1] or 1)
               for i in range(1, len(cl))]
        w = trs[-self.period:]
        return sum(w) / max(len(w), 1)


class TokenScorer:
    """Rule-based scoring with hard blocks and weighted momentum signals."""
    def __init__(self, cfg): self.cfg = cfg

    def score(self, d):
        reasons = []; sc = 0
        mc = safe_float(d.get("mc")); liq = safe_float(d.get("liq"))
        chg5 = safe_float(d.get("chg5m")); chg1 = safe_float(d.get("chg1m"))
        chg1h = safe_float(d.get("chg1h")); vol5 = safe_float(d.get("vol5m"))
        holders = safe_float(d.get("holders")); top10 = safe_float(d.get("top10_pct"))
        txs1h = safe_float(d.get("txs1h")); age = safe_float(d.get("age_min"), 9999)
        mint_a = d.get("mint_auth", False); freeze_a = d.get("freeze_auth", False)

        # Hard blocks
        if mint_a or freeze_a:        return 0, ["BLOCK: mint/freeze auth"]
        if top10 == -1:               return 0, ["BLOCK: top10=-1"]
        if top10 > self.cfg.get("top10_rug_block_pct", 85): return 0, [f"BLOCK: top10={top10:.0f}%"]
        if mc  < self.cfg.get("min_mc_buy",  30000): return 0, [f"BLOCK: mc=${mc:.0f}"]
        if liq < self.cfg.get("min_liq_buy",  3000): return 0, [f"BLOCK: liq=${liq:.0f}"]
        if txs1h < 10:                return 0, [f"BLOCK: txs={txs1h:.0f}"]
        if vol5 > 0 and holders > 0 and (vol5 / holders) > 5000: return 0, ["BLOCK: wash vol"]

        liq_mc = liq / mc if mc > 0 else 0
        if liq_mc >= 0.05:   sc += 12; reasons.append(f"Liq/MC={liq_mc:.1%}✓")
        elif liq_mc >= 0.02: sc += 6

        if chg5 > 0.05:    sc += 18; reasons.append(f"chg5m=+{chg5:.1%}🔥")
        elif chg5 > 0.02:  sc += 10
        elif chg5 < -0.05: sc -= 10

        if chg1 > 0.03:    sc += 14; reasons.append(f"chg1m=+{chg1:.1%}⚡")
        elif chg1 > 0.01:  sc += 7
        elif chg1 < -0.03: sc -= 8

        if chg1h > 0.10:    sc += 8; reasons.append("1h UP")
        elif chg1h < -0.20: sc -= 5

        if vol5 > 100000:  sc += 14; reasons.append(f"vol=${vol5/1000:.0f}k🔥")
        elif vol5 > 30000: sc += 8
        elif vol5 > 10000: sc += 4

        if holders >= 200: sc += 8
        elif holders >= 50: sc += 4

        if top10 <= 30:   sc += 10; reasons.append(f"top10={top10:.0f}%✓")
        elif top10 <= 50: sc += 5
        elif top10 > 70:  sc -= 5

        if 5 <= age <= 60:  sc += 6; reasons.append(f"age={age:.0f}m✓")
        elif age < 5:       sc -= 5
        elif age > 360:     sc -= 3

        return max(0, min(100, sc)), reasons


def kelly_size(wr, avg_w, avg_l, balance, cfg):
    """Fractional Kelly Criterion for optimal bet sizing."""
    if avg_l == 0 or wr <= 0: return cfg["min_trade_sol"]
    p = wr; q = 1 - p; b = avg_w / max(abs(avg_l), 0.001)
    kelly = max(0.0, (p * b - q) / max(b, 0.001)) * cfg.get("kelly_fraction", 0.25)
    return max(cfg["min_trade_sol"], min(cfg["max_trade_sol"], balance * kelly))


class MarketTrend:
    def __init__(self): self.w = deque(maxlen=20)
    def add(self, pnl): self.w.append(pnl)
    def trend(self):
        if len(self.w) < 5: return "neutral"
        avg = sum(self.w) / len(self.w)
        return "bull" if avg > 0.03 else ("bear" if avg < -0.02 else "neutral")


class DataFetcher:
    DS_TRENDING = "https://api.dexscreener.com/token-boosts/latest/v1"
    DS_PROFILES = "https://api.dexscreener.com/token-profiles/latest/v1"
    DS_PAIRS    = "https://api.dexscreener.com/latest/dex/tokens/{}"

    def __init__(self, cfg, session):
        self.cfg = cfg; self.session = session

    async def _get(self, url, timeout=8):
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                if r.status == 200: return await r.json(content_type=None)
        except Exception as e: log.debug(f"GET {url[:55]}: {e}")
        return None

    async def trending_mints(self):
        mints = set()
        for url in [self.DS_TRENDING, self.DS_PROFILES]:
            data = await self._get(url)
            if not data: continue
            items = data if isinstance(data, list) else data.get("data", [])
            for item in (items or [])[:30]:
                chain = item.get("chainId", item.get("chain", ""))
                if chain != "solana": continue
                mint = item.get("tokenAddress", item.get("address", ""))
                if mint and len(mint) > 30: mints.add(mint)
        return list(mints)[:40]

    async def token_data(self, mint):
        data = await self._get(self.DS_PAIRS.format(mint), timeout=6)
        if not data: return None
        pairs = data.get("pairs", [])
        if not pairs: return None
        sol = [p for p in pairs if p.get("chainId") == "solana"
               and p.get("quoteToken", {}).get("symbol") in ("SOL", "WSOL")]
        if not sol: sol = [p for p in pairs if p.get("chainId") == "solana"]
        if not sol: return None
        p = max(sol, key=lambda x: safe_float(x.get("liquidity", {}).get("usd")))
        mc = safe_float(p.get("marketCap") or p.get("fdv"))
        liq = safe_float(p.get("liquidity", {}).get("usd"))
        price = safe_float(p.get("priceUsd"))
        chg = p.get("priceChange", {}); vol = p.get("volume", {})
        txns = p.get("txns", {}); info = p.get("info", {})
        created = p.get("pairCreatedAt", 0)
        age_min = (time.time() * 1000 - (created or 0)) / 60000 if created else 9999
        return {
            "mint": mint, "name": p.get("baseToken", {}).get("symbol", "???"),
            "price": price, "mc": mc, "liq": liq,
            "chg1m": safe_float(chg.get("m1")) / 100,
            "chg5m": safe_float(chg.get("m5")) / 100,
            "chg1h": safe_float(chg.get("h1")) / 100,
            "vol5m": safe_float(vol.get("m5")),
            "vol1m": safe_float(vol.get("m1")),
            "txs1h": safe_float(txns.get("h1", {}).get("buys", 0)) + safe_float(txns.get("h1", {}).get("sells", 0)),
            "holders": safe_float(info.get("holders", 100)),
            "top10_pct": safe_float(info.get("top10HoldersPercent", 50)),
            "mint_auth": info.get("mintAuthority") not in (None, False, ""),
            "freeze_auth": info.get("freezeAuthority") not in (None, False, ""),
            "age_min": age_min,
            "pair_addr": p.get("pairAddress", ""),
        }

    async def wallet_sol(self, address):
        rpc = self.cfg.get("rpc_url", "")
        if not rpc or not address: return 0.0
        try:
            async with self.session.post(rpc, json={"jsonrpc": "2.0", "id": 1,
                "method": "getBalance", "params": [address]},
                timeout=aiohttp.ClientTimeout(total=5)) as r:
                d = await r.json()
            return d.get("result", {}).get("value", 0) / 1e9
        except: return 0.0

    async def token_balance_raw(self, address, mint):
        rpc = self.cfg.get("rpc_url", "")
        try:
            async with self.session.post(rpc, json={"jsonrpc": "2.0", "id": 1,
                "method": "getTokenAccountsByOwner",
                "params": [address, {"mint": mint}, {"encoding": "jsonParsed"}]},
                timeout=aiohttp.ClientTimeout(total=8)) as r:
                d = await r.json()
            for acc in d.get("result", {}).get("value", []):
                info = acc["account"]["data"]["parsed"]["info"]
                return int(info["tokenAmount"]["amount"])
        except: pass
        return 0


class JupiterExecutor:
    def __init__(self, cfg, session, keypair):
        self.cfg = cfg; self.session = session; self.keypair = keypair
        self.jup = cfg.get("jupiter_api", "https://lite-api.jup.ag/swap/v1")

    async def _quote(self, in_mint, out_mint, amount, slippage_bps=300):
        try:
            async with self.session.get(f"{self.jup}/quote", params={
                "inputMint": in_mint, "outputMint": out_mint,
                "amount": amount, "slippageBps": slippage_bps},
                timeout=aiohttp.ClientTimeout(total=8)) as r:
                d = await r.json(content_type=None)
            return None if "error" in d or "inputMint" not in d else d
        except Exception as e: log.debug(f"quote: {e}"); return None

    async def _swap(self, quote):
        from base64 import b64decode
        try:
            async with self.session.post(f"{self.jup}/swap", json={
                "quoteResponse": quote,
                "userPublicKey": str(self.keypair.pubkey()),
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": self.cfg.get("priority_fee_lamports", 80000)},
                timeout=aiohttp.ClientTimeout(total=15)) as r:
                d = await r.json(content_type=None)
            if "swapTransaction" not in d: log.warning(str(d)[:100]); return None
            from solders.transaction import VersionedTransaction
            from solana.rpc.async_api import AsyncClient
            from solana.rpc.commitment import Confirmed
            raw = b64decode(d["swapTransaction"])
            tx = VersionedTransaction.from_bytes(raw)
            signed = VersionedTransaction(tx.message, [self.keypair])
            async with AsyncClient(self.cfg["rpc_url"], commitment=Confirmed) as client:
                res = await client.send_raw_transaction(bytes(signed))
                return str(res.value)
        except Exception as e: log.error(f"_swap: {e}"); return None

    async def buy(self, mint, sol_amount):
        q = await self._quote(SOL_MINT, mint, int(sol_amount * 1e9))
        if not q: return None
        pi = safe_float(q.get("priceImpactPct"))
        if pi > 10: log.warning(f"priceImpact={pi:.1f}% skip"); return None
        return await self._swap(q)

    async def sell(self, mint, amount_raw):
        if amount_raw <= 0: return None
        q = await self._quote(mint, SOL_MINT, amount_raw, slippage_bps=1000)
        return await self._swap(q) if q else None


class Telegram:
    def __init__(self, token, chat_id, session):
        self.token = token; self.chat_id = chat_id; self.session = session

    async def send(self, text):
        if not self.token or not self.chat_id: return
        try:
            await self.session.post(
                f"https://api.telegram.org/bot{self.token}/sendMessage",
                json={"chat_id": self.chat_id, "text": text, "parse_mode": "HTML"},
                timeout=aiohttp.ClientTimeout(total=5))
        except: pass


class Bot:
    def __init__(self, cfg):
        self.cfg = {**DEFAULT_CFG, **cfg}
        self._running = False; self.session = None
        self.keypair = None; self.address = ""
        self.positions = {}; self.memory = {}
        self.blocked = set(); self.cooldown = {}; self.atr_map = {}
        self.scorer = TokenScorer(self.cfg)
        self.market_trend = MarketTrend()
        self.ql = QLearningAgent(self.cfg["ql_alpha"], self.cfg["ql_gamma"], self.cfg["ql_epsilon"])
        self._loss_streak = 0; self._pause_until = 0.0
        self._threshold = float(self.cfg.get("pf_min_score", 62))
        self._ql_state = None; self._ql_action = 0; self._scan_count = 0

    def stop(self): self._running = False

    async def run(self):
        self._running = True
        self._load_state(); self._init_keypair()
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=40, ttl_dns_cache=300),
            headers={"User-Agent": "BOOBY-BOT/30"})
        self.fetcher = DataFetcher(self.cfg, self.session)
        self.executor = JupiterExecutor(self.cfg, self.session, self.keypair)
        self.tg = Telegram(self.cfg.get("telegram_token", ""), self.cfg.get("telegram_chat_id", ""), self.session)
        log.info(f"🌴 BOOBY BOT v30 | wallet={self.address[:20]}... | th={self._threshold:.0f} | dry={self.cfg['dry_run']}")
        try:
            await asyncio.gather(self._scan_loop(), self._monitor_loop(), self._ql_loop())
        except asyncio.CancelledError: pass
        finally:
            if self.session: await self.session.close()
            self._save_state(); log.info("🛑 Stopped")

    def _load_state(self):
        self.memory = read_json(self.cfg["memory_file"],
            {"trades": [], "stats": {}, "blocked": [], "threshold": 62.0, "ql": {}})
        self.positions = read_json(self.cfg["positions_file"], {})
        self.blocked = set(self.memory.get("blocked", []))
        self._threshold = float(self.memory.get("threshold", self._threshold))
        self.ql.from_dict(self.memory.get("ql", {}))
        self._loss_streak = self.memory.get("stats", {}).get("loss_streak", 0)

    def _save_state(self):
        self.memory["threshold"] = self._threshold
        self.memory["blocked"] = list(self.blocked)[:500]
        self.memory["ql"] = self.ql.to_dict()
        write_json(self.cfg["memory_file"], self.memory)
        write_json(self.cfg["positions_file"], self.positions)

    def _init_keypair(self):
        d = read_json(self.cfg.get("wallet_file", "wallet.json"), {})
        if not d: self.cfg["dry_run"] = True; log.warning("wallet.json not found – dry_run forced"); return
        try:
            from solders.keypair import Keypair
            self.keypair = Keypair.from_bytes(bytes(d.get("secret_key", [])))
            self.address = str(self.keypair.pubkey())
        except Exception as e:
            log.error(f"Keypair: {e}"); self.cfg["dry_run"] = True

    async def _scan_loop(self):
        while self._running:
            try: await self._scan_once()
            except Exception as e: log.error(f"scan: {e}")
            await asyncio.sleep(self.cfg["scan_interval_sec"])

    async def _scan_once(self):
        self._scan_count += 1
        if time.time() < self._pause_until:
            if self._scan_count % 30 == 0:
                log.warning(f"⏸ PAUSED {(self._pause_until - time.time()) / 60:.0f}min")
            return
        if len(self.positions) >= self.cfg["max_open_positions"]: return
        bal = await self.fetcher.wallet_sol(self.address)
        self.memory["last_balance_sol"] = bal
        if bal < self.cfg["min_wallet_sol"]:
            if self._scan_count % 30 == 0: log.warning(f"⚠ Low wallet: {bal:.4f} SOL")
            return
        mints = await self.fetcher.trending_mints()
        if self._scan_count % 10 == 1:
            log.info(f"🔍 Scan #{self._scan_count} | {len(mints)} mints | bal={bal:.4f} SOL | th={self._threshold:.0f} | pos={len(self.positions)}/{self.cfg['max_open_positions']}")
        random.shuffle(mints)
        candidates = 0
        for mint in mints:
            if not self._running: break
            if mint in self.positions or mint in self.blocked: continue
            if mint in self.cooldown:
                if time.time() < self.cooldown[mint]: continue
                del self.cooldown[mint]
            try:
                tdata = await self.fetcher.token_data(mint)
                if not tdata: continue
                sc, reasons = self.scorer.score(tdata)
                if sc < self._threshold:
                    if sc >= self._threshold - 15:
                        candidates += 1
                        log.info(f"  📊 {tdata['name']} sc={sc:.0f} (need {self._threshold:.0f}) — {' | '.join(reasons[:2])}")
                    continue
                strat = self._pick_strategy(tdata)
                log.info(f"🎯 {tdata['name']} sc={sc:.0f} [{strat}] {' | '.join(reasons[:3])}")
                await self._enter(tdata, sc, strat, bal)
                if len(self.positions) >= self.cfg["max_open_positions"]: break
            except Exception as e: log.debug(f"scan {mint[:8]}: {e}")
        if self._scan_count % 10 == 1 and candidates == 0 and not self.positions:
            log.info(f"  💤 No signals above threshold {self._threshold:.0f} — waiting...")

    def _pick_strategy(self, d):
        age = d.get("age_min", 9999); mc = d.get("mc", 0)
        if age < 30 and mc < 500000: return "pumpfun"
        if d.get("chg1m", 0) > 0.04 and d.get("chg5m", 0) > 0.06: return "momentum"
        if d.get("chg5m", 0) < -0.03 and d.get("chg1m", 0) > 0.01: return "mean_reversion"
        return "momentum"

    def _strat_cfg(self, strat):
        if strat == "pumpfun":
            return {"profit": self.cfg["pf_profit"], "stop": self.cfg["pf_stop"], "max_hold": self.cfg["pf_max_hold"]}
        return {"profit": self.cfg["mo_profit"], "stop": self.cfg["mo_stop"], "max_hold": self.cfg["mo_max_hold"]}

    async def _enter(self, tdata, score, strat, balance):
        mint = tdata["mint"]; name = tdata["name"]; price = tdata.get("price", 0)
        if price <= 0: return
        s = self.memory.get("stats", {})
        size = kelly_size(s.get("win_rate", 0.5), s.get("avg_win", 0.08), s.get("avg_loss", 0.02), balance, self.cfg)
        atr_c = self.atr_map.get(mint)
        atr = atr_c.get_atr() if atr_c else 0.025
        sc = self._strat_cfg(strat)
        dyn_stop = max(sc["stop"], -atr * 1.5)
        log.info(f"🛒 BUY {name} ◎{size:.4f} stop={dyn_stop:.1%} atr={atr:.2%}")
        await self.tg.send(f"🛒 <b>BUY {name}</b>\n◎{size:.4f} | score={score:.0f} | {strat}")
        sig = None
        if not self.cfg["dry_run"]:
            sig = await self.executor.buy(mint, size)
            if not sig: log.warning(f"  BUY TX failed: {name}"); return
            log.info(f"  TX: https://solscan.io/tx/{sig}"); await asyncio.sleep(2)
        self.positions[mint] = {
            "name": name, "strategy": strat, "entry_price": price, "amount_sol": size,
            "score": score, "opened_at": datetime.now().isoformat(),
            "peak_price": price, "dyn_stop": dyn_stop, "target": sc["profit"],
            "max_hold_min": sc["max_hold"], "tx_buy": sig or "DRY", "atr": atr, "held_min": 0.0,
        }
        self._save_state()

    async def _monitor_loop(self):
        while self._running:
            try:
                for mint in list(self.positions.keys()):
                    if not self._running: break
                    if mint in self.positions: await self._monitor_pos(mint)
            except Exception as e: log.error(f"monitor: {e}")
            await asyncio.sleep(3)

    async def _monitor_pos(self, mint):
        pos = self.positions.get(mint)
        if not pos: return
        tdata = await self.fetcher.token_data(mint)
        if not tdata or tdata.get("price", 0) <= 0: return
        curr = tdata["price"]; entry = pos["entry_price"]
        if entry <= 0: return
        pnl = (curr - entry) / entry
        if curr > pos["peak_price"]: pos["peak_price"] = curr
        last = pos.get("last_price", curr)
        hi = max(curr, last); lo = min(curr, last)
        self.atr_map.setdefault(mint, ATRCalc(self.cfg["atr_period"])).add(hi, lo, curr)
        pos["last_price"] = curr
        peak_pnl = (pos["peak_price"] - entry) / entry
        if peak_pnl > 0.10:   trail = pos["peak_price"] * 0.92
        elif peak_pnl > 0.05: trail = pos["peak_price"] * 0.95
        else:                  trail = entry * (1 + pos["dyn_stop"])
        opened = datetime.fromisoformat(pos["opened_at"])
        held = (datetime.now() - opened).total_seconds() / 60
        pos["held_min"] = held
        reason = None
        if pnl < self.cfg["rug_1s_threshold"]:     reason = "Rug-Alarm"
        elif pnl < self.cfg["emergency_stop_pct"]:  reason = "Emergency-Stop"
        elif curr < trail and pnl < -0.005:          reason = f"Trailing-Stop({pnl:+.1%})"
        elif pnl >= pos["target"]:                   reason = f"Profit({pnl:+.1%})"
        elif pnl <= pos["dyn_stop"]:                 reason = f"Stop-Loss({pnl:+.1%})"
        elif held >= pos["max_hold_min"]:
            suffix = "(loss)" if pnl < 0 else ("(profit)" if pnl > 0.02 else "/Stagnation")
            reason = f"Max-Hold{suffix}"
        if reason: await self._exit(mint, curr, reason)

    async def _exit(self, mint, curr_price, reason):
        pos = self.positions.get(mint)
        if not pos: return
        name = pos["name"]; entry = pos["entry_price"]; sol = pos["amount_sol"]
        pnl = (curr_price - entry) / entry if entry > 0 else 0
        pnl_s = sol * pnl; held = pos.get("held_min", 0)
        emoji = "✅" if pnl >= 0 else "❌"
        log.info(f"{emoji} SELL {name} {pnl:+.1%} | {pnl_s:+.5f} SOL | {reason}")
        await self.tg.send(f"{emoji} <b>SELL {name}</b>\n{pnl:+.1%} | {pnl_s:+.4f} SOL | {reason}")
        if not self.cfg["dry_run"]:
            raw = await self.fetcher.token_balance_raw(self.address, mint)
            if raw > 0:
                sig = await self.executor.sell(mint, raw)
                if sig: log.info(f"  TX: https://solscan.io/tx/{sig}")
        trades = self.memory.setdefault("trades", [])
        trades.append({"ts": now_ts(), "mint": mint, "name": name, "strat": pos["strategy"],
            "entry": entry, "exit": curr_price, "pnl_pct": round(pnl, 6), "pnl_sol": round(pnl_s, 6),
            "hold_min": round(held, 2), "reason": reason, "score": pos.get("score", 0)})
        if len(trades) > 5000: self.memory["trades"] = trades[-5000:]
        self._update_stats(pnl, pnl_s); self.market_trend.add(pnl)
        if "Stop" in reason or "Rug" in reason:
            self.cooldown[mint] = time.time() + self.cfg["stop_loss_cooldown_min"] * 60
        if "Rug" in reason:
            self.blocked.add(mint); log.warning(f"  🛡 {name} BLOCKED")
        del self.positions[mint]; self._save_state()

    def _update_stats(self, pnl_pct, pnl_sol):
        s = self.memory.setdefault("stats", {"n": 0, "wins": 0, "pnl": 0.0,
            "avg_win": 0.08, "avg_loss": 0.02, "win_rate": 0.5, "loss_streak": 0})
        s["n"] = s.get("n", 0) + 1
        s["pnl"] = s.get("pnl", 0.0) + pnl_sol
        if pnl_pct > 0:
            s["wins"] = s.get("wins", 0) + 1
            s["avg_win"] = s.get("avg_win", 0.08) * 0.9 + abs(pnl_pct) * 0.1
            self._loss_streak = 0
        else:
            s["avg_loss"] = s.get("avg_loss", 0.02) * 0.9 + abs(pnl_pct) * 0.1
            self._loss_streak += 1
        s["win_rate"] = s["wins"] / s["n"] if s["n"] > 0 else 0.5
        s["loss_streak"] = self._loss_streak
        if self._loss_streak >= self.cfg["loss_streak_limit"]:
            self._pause_until = time.time() + self.cfg["loss_streak_pause_min"] * 60
            log.warning(f"⏸ STREAK {self._loss_streak}x – pause {self.cfg['loss_streak_pause_min']}min")
            self._loss_streak = 0; s["loss_streak"] = 0

    async def _ql_loop(self):
        await asyncio.sleep(120)
        while self._running:
            try: await self._ql_step()
            except Exception as e: log.debug(f"ql: {e}")
            await asyncio.sleep(180)

    async def _ql_step(self):
        s = self.memory.get("stats", {}); wr = s.get("win_rate", 0.5)
        strk = self._loss_streak; tr = self.market_trend.trend()
        act = self.ql.select_action(wr, strk, tr)
        if self._ql_state is not None:
            wr0, s0, t0 = self._ql_state
            rew = (wr - 0.5) * 2 - (0.5 if strk >= 3 else 0.0)
            self.ql.update(wr0, s0, t0, self._ql_action, rew, wr, strk, tr)
        old = self._threshold
        self._threshold = max(50.0, min(85.0, self._threshold + act))
        if act != 0:
            log.info(f"🧠 QL: th {old:.0f}→{self._threshold:.0f} (act={act:+d} wr={wr:.1%} {tr})")
        self._ql_state = (wr, strk, tr); self._ql_action = act
        self.memory["threshold"] = self._threshold
