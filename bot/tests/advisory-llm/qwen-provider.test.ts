import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QwenAdvisoryProvider } from "../../src/advisory-llm/providers/qwen.js";

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

const samplePack = {
  decision: {
    schemaVersion: "decision.envelope.v3" as const,
    entrypoint: "engine" as const,
    flow: "trade" as const,
    executionMode: "dry" as const,
    traceId: "qwen-provider-trace",
    stage: "monitor" as const,
    blocked: false,
    reasonClass: "SUCCESS" as const,
    sources: ["market:dexpaprika"],
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
};

describe("QwenAdvisoryProvider", () => {
  beforeEach(() => {
    createMock.mockReset();
    ctorCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends an OpenAI-compatible request and normalizes the response", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "summary",
              reasoning: "reasoning",
              riskNotes: ["risk"],
              anomalies: ["anomaly"],
              confidence: 0.9,
              provider: "upstream",
              model: "upstream-model",
            }),
          },
        },
      ],
    });

    const provider = new QwenAdvisoryProvider({
      apiKey: "qwen-api-key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.6-plus",
      maxTokens: 256,
    });

    const result = await provider.generate(samplePack);

    expect(ctorCalls[0]).toEqual({
      apiKey: "qwen-api-key",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      model: "qwen3.6-plus",
      max_tokens: 256,
      temperature: 0.2,
    });
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("response_format");
    expect(String(createMock.mock.calls[0][0].messages[1].content)).toContain('Echo provider as "qwen"');
    expect(result).toMatchObject({
      summary: "summary",
      reasoning: "reasoning",
      riskNotes: ["risk"],
      anomalies: ["anomaly"],
      confidence: 0.9,
      provider: "qwen",
      model: "qwen3.6-plus",
    });
  });

  it("fails closed on malformed upstream JSON", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "not-json",
          },
        },
      ],
    });

    const provider = new QwenAdvisoryProvider({
      apiKey: "qwen-api-key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.6-plus",
      maxTokens: 256,
    });

    await expect(provider.generate(samplePack)).rejects.toThrow("ADVISORY_QWEN_JSON_PARSE");
  });
});
