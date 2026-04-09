/**
 * Advisory LLM service — OFF by default; never blocks callers; returns null on any failure.
 */
import { createHash } from "node:crypto";
import type {
  AdvisoryCallAuditLog,
  AdvisoryEvidencePack,
  AdvisoryLLMProvider,
  AdvisoryLLMResponse,
  DecisionEnvelopeV3,
} from "./types.js";
import { OpenAIAdvisoryProvider } from "./providers/openai.js";
import { QwenAdvisoryProvider } from "./providers/qwen.js";
import { XaiAdvisoryProvider } from "./providers/xai.js";

export interface AdvisoryLLMServiceConfig {
  enabled: boolean;
  provider: "openai" | "xai" | "qwen";
  timeoutMs: number;
  maxTokens: number;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  xaiApiKey?: string;
  xaiBaseUrl?: string;
  xaiModel?: string;
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;
}

function normalizeOptionalText(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function parseAdvisoryProvider(raw: string | undefined): "openai" | "xai" | "qwen" {
  const normalized = (raw ?? "openai").trim().toLowerCase();
  if (normalized === "openai" || normalized === "xai" || normalized === "qwen") {
    return normalized;
  }
  throw new Error("ADVISORY_LLM_PROVIDER must be one of: openai, xai, qwen.");
}

export function readAdvisoryLLMConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AdvisoryLLMServiceConfig {
  const enabled = env.ADVISORY_LLM_ENABLED === "true";
  const provider = parseAdvisoryProvider(env.ADVISORY_LLM_PROVIDER);
  const timeoutMs = Math.min(30_000, Math.max(100, parseInt(env.ADVISORY_LLM_TIMEOUT_MS ?? "1200", 10) || 1200));
  const maxTokens = Math.min(4096, Math.max(64, parseInt(env.ADVISORY_LLM_MAX_TOKENS ?? "512", 10) || 512));
  return {
    enabled,
    provider,
    timeoutMs,
    maxTokens,
    openaiApiKey: normalizeOptionalText(env.OPENAI_API_KEY),
    openaiBaseUrl: normalizeOptionalText(env.OPENAI_BASE_URL),
    openaiModel: normalizeOptionalText(env.OPENAI_MODEL) ?? "gpt-4o-mini",
    xaiApiKey: normalizeOptionalText(env.XAI_API_KEY),
    xaiBaseUrl: normalizeOptionalText(env.XAI_API_BASE_URL),
    xaiModel: normalizeOptionalText(env.XAI_MODEL_PRIMARY) ?? "grok-beta",
    qwenApiKey: normalizeOptionalText(env.QWEN_API_KEY),
    qwenBaseUrl: normalizeOptionalText(env.QWEN_BASE_URL),
    qwenModel: normalizeOptionalText(env.QWEN_MODEL) ?? "qwen3.6-plus",
  };
}

async function raceWithTimeout<T>(
  fn: () => Promise<T>,
  ms: number
): Promise<{ ok: true; value: T } | { ok: false; reason: "timeout" | "error"; message?: string }> {
  const timeoutError = new Error("ADVISORY_TIMEOUT");
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(timeoutError), ms);
      }),
    ]);
    return { ok: true, value };
  } catch (err) {
    if (err === timeoutError || (err instanceof Error && err.message === "ADVISORY_TIMEOUT")) {
      return { ok: false, reason: "timeout" };
    }
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function cacheKeyForPack(pack: AdvisoryEvidencePack): string {
  return createHash("sha256").update(JSON.stringify(pack.decision)).digest("hex");
}

function buildProvider(
  config: AdvisoryLLMServiceConfig,
  which: "openai" | "xai" | "qwen"
): { provider: AdvisoryLLMProvider; model: string } | { error: string; model: string } {
  if (which === "openai") {
    const key = config.openaiApiKey?.trim();
    if (!key) return { error: "ADVISORY_NO_PROVIDER_KEY", model: "(no_api_key)" };
    return {
      provider: new OpenAIAdvisoryProvider({
        apiKey: key,
        baseUrl: config.openaiBaseUrl,
        model: config.openaiModel ?? "gpt-4o-mini",
        maxTokens: config.maxTokens,
      }),
      model: config.openaiModel ?? "gpt-4o-mini",
    };
  }
  if (which === "xai") {
    const key = config.xaiApiKey?.trim();
    if (!key) return { error: "ADVISORY_NO_PROVIDER_KEY", model: "(no_api_key)" };
    return {
      provider: new XaiAdvisoryProvider({
        apiKey: key,
        baseUrl: config.xaiBaseUrl,
        model: config.xaiModel ?? "grok-beta",
        maxTokens: config.maxTokens,
      }),
      model: config.xaiModel ?? "grok-beta",
    };
  }
  if (which !== "qwen") {
    return { error: "ADVISORY_UNSUPPORTED_PROVIDER", model: "(unsupported_provider)" };
  }
  const key = config.qwenApiKey?.trim();
  if (!key) return { error: "ADVISORY_NO_PROVIDER_KEY", model: "(no_api_key)" };
  const baseUrl = config.qwenBaseUrl?.trim();
  if (!baseUrl) return { error: "ADVISORY_NO_PROVIDER_BASE_URL", model: "(no_base_url)" };
  return {
    provider: new QwenAdvisoryProvider({
      apiKey: key,
      baseUrl,
      model: config.qwenModel ?? "qwen3.6-plus",
      maxTokens: config.maxTokens,
    }),
    model: config.qwenModel ?? "qwen3.6-plus",
  };
}

export class AdvisoryLLMService {
  constructor(private readonly config: AdvisoryLLMServiceConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Returns advisory JSON or null (disabled, timeout, error, invalid schema).
   */
  async explain(pack: AdvisoryEvidencePack): Promise<{
    advisory: AdvisoryLLMResponse | null;
    audit: AdvisoryCallAuditLog;
  }> {
    const traceId = pack.decision.traceId;
    const cacheKey = cacheKeyForPack(pack);
    if (!this.config.enabled) {
      return {
        advisory: null,
        audit: {
          traceId,
          provider: this.config.provider,
          model: "(disabled)",
          latencyMs: 0,
          success: false,
          cacheKey,
          error: "ADVISORY_DISABLED",
        },
      };
    }

    const providerOutcome = buildProvider(this.config, this.config.provider);
    if ("error" in providerOutcome) {
      return {
        advisory: null,
        audit: {
          traceId,
          provider: this.config.provider,
          model: providerOutcome.model,
          latencyMs: 0,
          success: false,
          cacheKey,
          error: providerOutcome.error,
        },
      };
    }

    const started = Date.now();
    const outcome = await raceWithTimeout(() => providerOutcome.provider.generate(pack), this.config.timeoutMs);
    const latencyMs = Date.now() - started;

    if (!outcome.ok) {
      return {
        advisory: null,
        audit: {
          traceId,
          provider: providerOutcome.provider.id,
          model: providerOutcome.model,
          latencyMs,
          success: false,
          cacheKey,
          error: outcome.reason === "timeout" ? "ADVISORY_TIMEOUT" : outcome.message ?? "ADVISORY_ERROR",
        },
      };
    }

    return {
      advisory: outcome.value,
      audit: {
        traceId,
        provider: outcome.value.provider,
        model: outcome.value.model,
        latencyMs,
        success: true,
        cacheKey,
      },
    };
  }

  /**
   * Optional: second provider output for comparison (never merged into one truth).
   */
  async explainCompare(pack: AdvisoryEvidencePack): Promise<{
    primary: AdvisoryLLMResponse | null;
    secondary: AdvisoryLLMResponse | null;
    audits: AdvisoryCallAuditLog[];
  }> {
    const other: "openai" | "xai" | "qwen" = this.config.provider === "openai" ? "xai" : "openai";
    const a = await this.explain(pack);
    const audits = [a.audit];
    const second = buildProvider(this.config, other);
    if (!this.config.enabled || "error" in second) {
      return { primary: a.advisory, secondary: null, audits };
    }
    const started = Date.now();
    const outcome = await raceWithTimeout(() => second.provider.generate(pack), this.config.timeoutMs);
    const latencyMs = Date.now() - started;
    if (!outcome.ok) {
      audits.push({
        traceId: pack.decision.traceId,
        provider: second.provider.id,
        model: second.model,
        latencyMs,
        success: false,
        cacheKey: cacheKeyForPack(pack),
        error: outcome.reason === "timeout" ? "ADVISORY_TIMEOUT" : outcome.message ?? "ADVISORY_ERROR",
      });
      return { primary: a.advisory, secondary: null, audits };
    }
    audits.push({
      traceId: pack.decision.traceId,
      provider: outcome.value.provider,
      model: outcome.value.model,
      latencyMs,
      success: true,
      cacheKey: cacheKeyForPack(pack),
    });
    return { primary: a.advisory, secondary: outcome.value, audits };
  }
}

export function createAdvisoryLLMService(
  config: AdvisoryLLMServiceConfig = readAdvisoryLLMConfigFromEnv()
): AdvisoryLLMService {
  return new AdvisoryLLMService(config);
}

/** Type guard: only v3 envelopes are valid advisory input. */
export function isDecisionEnvelopeV3(
  d: import("../core/contracts/decision-envelope.js").DecisionEnvelope | undefined
): d is DecisionEnvelopeV3 {
  return d?.schemaVersion === "decision.envelope.v3";
}
