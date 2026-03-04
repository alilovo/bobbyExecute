# dotBot - C__AB_path

## Übersicht
Dieses Repository enthält eine produktionsreife Implementierung eines Onchain-Trading-Bots, der auf der **OrchestrAI-Architektur** basiert. Der Fokus liegt auf Sicherheit (Governance), Determinismus und einer robusten Pipeline für Handelsentscheidungen.

## Architektur
Die Architektur folgt einer strikten Pipeline:
`Ingest → Research → Signal → Risk → Execute → Verify → Journal → Monitor`

### Kernkomponenten
- **Ingest**: Datenerfassung von DEXs (DexPaprika) und Wallets (Moralis).
- **Signal**: Erzeugung von Handelssignalen auf Basis von Markt-Snapshots (CQD).
- **Governance (Fail-Closed)**: 
  - **Review Gates**: Mehrstufige Prüfung von Handelsentscheidungen.
  - **Guardrails**: Durchsetzung von Slippage-Limits, Allow- und Denylists.
  - **Circuit Breaker**: Schutz vor fehlerhaften Adaptern.
- **Determinismus**:
  - **Canonical JSON**: Strikte Regeln für die Serialisierung (Key-Sorting, Float-Rundung).
  - **SHA-256 Hashing**: Jede Entscheidung und jeder Journal-Eintrag wird kryptografisch verifiziert.

## Logik
Der Bot implementiert das Prinzip **"C > A == B"** (Governance-first):
1. **CQD (Compressed Quality Dataset)**: Einziger erlaubter Input für Entscheidungen.
2. **Decision Tokens**: Fälschungssichere Artefakte, die nach erfolgreicher Prüfung durch Risk/Governance erstellt werden.
3. **Execution**: Trades werden nur ausgeführt, wenn ein gültiger und verifizierter Decision Token vorliegt.

## Repository-Struktur
- `bot/`: Die Hauptimplementierung in TypeScript.
- `dor-bot/`: Legacy- oder Referenz-Implementierung in Python.
- `bot/src/packages/core-trading/`: Gemeinsame Kontrakte und Schemas (V1).

## Installation & Ausführung
### Voraussetzungen
- Node.js 20+
- npm

### Befehle (im `bot`-Verzeichnis)
```bash
npm install     # Abhängigkeiten installieren
npm run build   # TypeScript kompilieren
npm test        # Unit-Tests ausführen
npm run test:golden # Golden Tasks Validierung
```

## Konfiguration
Die Konfiguration erfolgt über YAML-Dateien in `bot/src/config/`:
- `guardrails.yaml`: Risk-Limits und Zugriffskontrolle.
- `permissions.yaml`: Mapping von Tools auf Berechtigungen.
- `agents.yaml`: Profile der KI-Agenten.
