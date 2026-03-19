import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createExecutionHandler } from "../../src/agents/execution.agent.js";
import { createRpcClient } from "../../src/adapters/rpc-verify/client.js";
import { FileSystemExecutionRepository } from "../../src/persistence/execution-repository.js";

const baseIntent = {
  traceId: "persisted-live-trace",
  timestamp: "2026-03-19T12:00:00.000Z",
  idempotencyKey: "persisted-live-key",
  tokenIn: "SOL",
  tokenOut: "USDC",
  amountIn: "1",
  minAmountOut: "0.95",
  slippagePercent: 1,
  dryRun: false,
  executionMode: "live" as const,
};

describe("Execution evidence persistence", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "execution-evidence-"));
  });

  afterEach(async () => {
    delete process.env.LIVE_TRADING;
    delete process.env.RPC_MODE;
    delete process.env.ROLLOUT_POSTURE;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists live refusal evidence durably to JSONL", async () => {
    process.env.LIVE_TRADING = "true";
    process.env.RPC_MODE = "real";
    process.env.ROLLOUT_POSTURE = "paper_only";

    const filePath = join(tempDir, "execution-evidence.jsonl");
    const repository = new FileSystemExecutionRepository(filePath);
    const handler = await createExecutionHandler({
      rpcClient: createRpcClient(),
      walletAddress: "11111111111111111111111111111111",
      signTransaction: async (tx) => tx,
      executionEvidenceRepository: repository,
    });

    const result = await handler(baseIntent);
    expect(result.success).toBe(false);
    expect(result.failureCode).toBe("micro_live_blocked");

    const loaded = await new FileSystemExecutionRepository(filePath).listByTradeIntentId(baseIntent.idempotencyKey);
    expect(loaded).toHaveLength(2);
    expect(loaded.map((record) => record.kind)).toEqual([
      "live_refusal_summary",
      "execution_summary",
    ]);
    expect(loaded[0].allowed).toBe(false);
    expect(loaded[0].failureCode).toBe("micro_live_blocked");
    expect(loaded[1].success).toBe(false);
  });
});
