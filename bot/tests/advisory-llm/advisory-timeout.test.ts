import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(
          () =>
            new Promise(() => {
              /* intentionally hangs */
            })
        ),
      },
    };
  },
}));

describe("AdvisoryLLMService timeout (PR-D1)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when provider never resolves", async () => {
    const { AdvisoryLLMService } = await import("../../src/advisory-llm/service.js");
    const pack = {
      decision: {
        schemaVersion: "decision.envelope.v3" as const,
        entrypoint: "engine" as const,
        flow: "trade" as const,
        executionMode: "dry" as const,
        traceId: "t-timeout",
        stage: "monitor" as const,
        blocked: false,
        reasonClass: "SUCCESS" as const,
        sources: ["s"],
        freshness: {
          marketAgeMs: 0,
          walletAgeMs: 0,
          maxAgeMs: 1,
          observedAt: "2026-04-01T00:00:00.000Z",
        },
        evidenceRef: {},
        decisionHash: "c".repeat(64),
        resultHash: "d".repeat(64),
      },
    };
    const svc = new AdvisoryLLMService({
      enabled: true,
      provider: "openai",
      timeoutMs: 60,
      maxTokens: 128,
      openaiApiKey: "sk-x",
      openaiModel: "gpt-4o-mini",
    });
    const { advisory, audit } = await svc.explain(pack);
    expect(advisory).toBeNull();
    expect(audit.error).toBe("ADVISORY_TIMEOUT");
  });
});
