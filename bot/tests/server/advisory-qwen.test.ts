import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../src/server/index.js";

const createMock = vi.fn();
const ctorCalls: Array<{ apiKey: string; baseURL?: string }> = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    };

    constructor(options: { apiKey: string; baseURL?: string }) {
      ctorCalls.push(options);
    }
  },
}));

const traceId = "advisory-qwen-trace";

function runtimeSnapshot() {
  return {
    status: "running" as const,
    mode: "paper" as const,
    paperModeActive: true,
    cycleInFlight: false,
    counters: {
      cycleCount: 1,
      decisionCount: 1,
      executionCount: 0,
      blockedCount: 0,
      errorCount: 0,
    },
    lastCycleAt: "2026-04-01T00:00:00.000Z",
    lastDecisionAt: "2026-04-01T00:00:00.000Z",
    lastState: {
      stage: "monitor",
      traceId,
      timestamp: "2026-04-01T00:00:00.000Z",
      blocked: false,
    },
    recentHistory: {
      recentCycleCount: 1,
      cycleOutcomes: { success: 1, blocked: 0, error: 0 },
      attemptsByMode: { dry: 0, paper: 1, live: 0 },
      refusalCounts: {},
      failureStageCounts: {},
      verificationHealth: { passed: 0, failed: 0, failureReasons: {} },
      incidentCounts: {},
      controlActions: [],
      stateTransitions: [],
      recentCycles: [
        {
          traceId,
          cycleTimestamp: "2026-04-01T00:00:00.000Z",
          mode: "paper" as const,
          outcome: "success" as const,
          stage: "monitor",
          blocked: false,
          intakeOutcome: "ok" as const,
          executionOccurred: true,
          verificationOccurred: true,
          decisionOccurred: true,
          errorOccurred: false,
          decisionEnvelope: {
            schemaVersion: "decision.envelope.v3" as const,
            entrypoint: "engine" as const,
            flow: "trade" as const,
            executionMode: "paper" as const,
            traceId,
            stage: "monitor" as const,
            blocked: false,
            reasonClass: "SUCCESS" as const,
            sources: ["fixture"],
            freshness: {
              marketAgeMs: 0,
              walletAgeMs: 0,
              maxAgeMs: 60000,
              observedAt: "2026-04-01T00:00:00.000Z",
            },
            evidenceRef: {},
            decisionHash: "a".repeat(64),
            resultHash: "b".repeat(64),
          },
        },
      ],
      recentIncidents: [],
    },
  };
}

describe("advisory qwen route", () => {
  beforeEach(() => {
    createMock.mockReset();
    ctorCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a qwen advisory payload through the server route", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "summary",
              reasoning: "reasoning",
              confidence: 0.88,
              provider: "qwen",
              model: "qwen3.6-plus",
            }),
          },
        },
      ],
    });

    const server = await createServer({
      port: 0,
      host: "127.0.0.1",
      getRuntimeSnapshot: runtimeSnapshot,
      advisoryLLMConfig: {
        enabled: true,
        provider: "qwen",
        timeoutMs: 1000,
        maxTokens: 256,
        qwenApiKey: "qwen-api-key",
        qwenBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        qwenModel: "qwen3.6-plus",
      },
    });

    try {
      const address = server.server.address();
      if (typeof address !== "object" || address === null || !("port" in address)) {
        throw new Error("Failed to resolve advisory qwen test server port");
      }

      const response = await fetch(
        `http://127.0.0.1:${address.port}/kpi/decisions/${encodeURIComponent(traceId)}/advisory`
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.enabled).toBe(true);
      expect(body.advisory).toMatchObject({
        summary: "summary",
        reasoning: "reasoning",
        confidence: 0.88,
        provider: "qwen",
        model: "qwen3.6-plus",
      });
      expect(body.audits[0]).toMatchObject({
        provider: "qwen",
        success: true,
      });
      expect(ctorCalls[0]).toEqual({
        apiKey: "qwen-api-key",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      });
    } finally {
      await server.close();
    }
  });
});
