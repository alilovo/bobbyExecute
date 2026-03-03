"""
start.py – BOOBY BOT Starter v30
"""
import os, sys, json, webbrowser, time, threading

os.chdir(os.path.dirname(os.path.abspath(__file__)))

if "--dry-run" in sys.argv:
    cfg = json.load(open("config.json")) if os.path.exists("config.json") else {}
    cfg["dry_run"] = True
    with open("config.json", "w") as f: json.dump(cfg, f, indent=2)
    print("✓ Dry-Run aktiviert")

REQUIRED = ["fastapi", "uvicorn", "aiohttp", "websockets", "solana", "solders", "spl"]
missing = []
for pkg in REQUIRED:
    try: __import__(pkg)
    except ImportError: missing.append(pkg)

if missing:
    print(f"\n⚠️  Fehlende Pakete: {', '.join(missing)}")
    print(f"  pip install {' '.join(missing)}\n")
    sys.exit(1)

def open_browser():
    time.sleep(2)
    webbrowser.open("http://localhost:8000")

threading.Thread(target=open_browser, daemon=True).start()

print("╔══════════════════════════════════════════╗")
print("║  🌴  BOOBY BOT v30 – Dashboard  🌴       ║")
print("╠══════════════════════════════════════════╣")
print("║  🍑  http://localhost:8000               ║")
print("║  🧠  Q-Learning + Kelly + ATR Stops      ║")
print("║      Ctrl+C zum Beenden                  ║")
print("╚══════════════════════════════════════════╝\n")

import uvicorn
from server import app
uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
