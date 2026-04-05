import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "..", "..", "src");

async function readSrc(rel: string): Promise<string> {
  return readFile(join(srcRoot, rel), "utf8");
}

const FORBIDDEN_SCORE_PATTERN =
  /intelligence\/scoring|score_card\.v1|score_component\.v1|buildScoreCardV1/;

describe("score card bridge stays out of authority paths", () => {
  const authorityFiles = [
    "core/engine.ts",
    "core/orchestrator.ts",
    "core/intelligence/mci-bci-formulas.ts",
    "core/contracts/scorecard.ts",
    "core/decision/decision-result-derivation.ts",
    "signals/signal-engine.ts",
    "patterns/pattern-engine.ts",
    "runtime/dry-run-runtime.ts",
    "runtime/live-runtime.ts",
    "execution/execution-engine.ts",
    "index.ts",
  ];

  for (const rel of authorityFiles) {
    it(`${rel} does not import the scoring bridge`, async () => {
      const text = await readSrc(rel);
      expect(text).not.toMatch(FORBIDDEN_SCORE_PATTERN);
    });
  }
});
