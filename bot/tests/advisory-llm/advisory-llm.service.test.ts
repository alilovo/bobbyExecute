/**
 * PR-D1: advisory LLM off by default, timeout, schema, no side effects on trading.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { parseAdvisoryLLMResponse } from "../../src/advisory-llm/schema.js";
import type { AdvisoryEvidencePack } from "../../src/advisory-llm/types.js";

const sampleV3 = {
  schemaVersion: "decision.envelope.v3" as const,
  entrypoint: "engine" as const,
  flow: "trade" as const,
  executionMode: "dry" as const,
  traceId: "t-adv-1",
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
};

const pack: AdvisoryEvidencePack = { decision: sampleV3 };

describe("AdvisoryLLMService (PR-D1)", () => {
  const orig = { ...process.env };

  beforeEach(() => {
    process.env = { ...orig };
  });

  afterEach(() => {
    process.env = orig;
  });

  it("disabled: no provider work; returns null advisory", async () => {
    process.env.ADVISORY_LLM_ENABLED = "false";
    const { AdvisoryLLMService, readAdvisoryLLMConfigFromEnv } = await import(
      "../../src/advisory-llm/service.js"
    );
    const svc = new AdvisoryLLMService(readAdvisoryLLMConfigFromEnv());
    expect(svc.isEnabled()).toBe(false);
    const { advisory, audit } = await svc.explain(pack);
    expect(advisory).toBeNull();
    expect(audit.success).toBe(false);
    expect(audit.error).toBe("ADVISORY_DISABLED");
  });

  it("enabled without API key: null advisory, fail-safe audit", async () => {
    process.env.ADVISORY_LLM_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    process.env.ADVISORY_LLM_PROVIDER = "openai";
    const { AdvisoryLLMService, readAdvisoryLLMConfigFromEnv } = await import(
      "../../src/advisory-llm/service.js"
    );
    const svc = new AdvisoryLLMService(readAdvisoryLLMConfigFromEnv());
    const { advisory, audit } = await svc.explain(pack);
    expect(advisory).toBeNull();
    expect(audit.error).toBe("ADVISORY_NO_PROVIDER_KEY");
  });

  it("schema: invalid JSON discarded", () => {
    expect(parseAdvisoryLLMResponse({ summary: "", reasoning: "ok", confidence: 0.5, provider: "p", model: "m" })).toBeNull();
    expect(
      parseAdvisoryLLMResponse({
        summary: "s",
        reasoning: "r",
        confidence: 0.5,
        provider: "p",
        model: "m",
      })
    ).not.toBeNull();
  });
});
