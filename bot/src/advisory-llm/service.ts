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
import { XaiAdvisoryProvider } from "./providers/xai.js";

export interface AdvisoryLLMServiceConfig {
  enabled: boolean;
  provider: "openai" | "xai";
  timeoutMs: number;
  maxTokens: number;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  xaiApiKey?: string;
  xaiBaseUrl?: string;
  xaiModel?: string;
}

export function readAdvisoryLLMConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AdvisoryLLMServiceConfig {
  const enabled = env.ADVISORY_LLM_ENABLED === "true";
  const providerRaw = (env.ADVISORY_LLM_PROVIDER ?? "openai").toLowerCase();
  const provider: "openai" | "xai" = providerRaw === "xai" ? "xai" : "openai";
  const timeoutMs = Math.min(30_000, Math.max(100, parseInt(env.ADVISORY_LLM_TIMEOUT_MS ?? "1200", 10) || 1200));
  const maxTokens = Math.min(4096, Math.max(64, parseInt(env.ADVISORY_LLM_MAX_TOKENS ?? "512", 10) || 512));
  return {
    enabled,
    provider,
    timeoutMs,
    maxTokens,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    openaiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    xaiApiKey: env.XAI_API_KEY,
    xaiBaseUrl: env.XAI_API_BASE_URL,
    xaiModel: env.XAI_MODEL_PRIMARY ?? "grok-beta",
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

function buildProvider(config: AdvisoryLLMServiceConfig, which: "openai" | "xai"): AdvisoryLLMProvider | null {
  if (which === "openai") {
    const key = config.openaiApiKey?.trim();
    if (!key) return null;
    return new OpenAIAdvisoryProvider({
      apiKey: key,
      baseUrl: config.openaiBaseUrl,
      model: config.openaiModel ?? "gpt-4o-mini",
      maxTokens: config.maxTokens,
    });
  }
  const key = config.xaiApiKey?.trim();
  if (!key) return null;
  return new XaiAdvisoryProvider({
    apiKey: key,
    baseUrl: config.xaiBaseUrl,
    model: config.xaiModel ?? "grok-beta",
    maxTokens: config.maxTokens,
  });
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

    const providerImpl = buildProvider(this.config, this.config.provider);
    if (!providerImpl) {
      return {
        advisory: null,
        audit: {
          traceId,
          provider: this.config.provider,
          model: "(no_api_key)",
          latencyMs: 0,
          success: false,
          cacheKey,
          error: "ADVISORY_NO_PROVIDER_KEY",
        },
      };
    }

    const started = Date.now();
    const outcome = await raceWithTimeout(() => providerImpl.generate(pack), this.config.timeoutMs);
    const latencyMs = Date.now() - started;

    if (!outcome.ok) {
      return {
        advisory: null,
        audit: {
          traceId,
          provider: providerImpl.id,
          model: this.config.provider === "openai" ? this.config.openaiModel ?? "" : this.config.xaiModel ?? "",
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
    const other: "openai" | "xai" = this.config.provider === "openai" ? "xai" : "openai";
    const a = await this.explain(pack);
    const audits = [a.audit];
    const second = buildProvider(this.config, other);
    if (!this.config.enabled || !second) {
      return { primary: a.advisory, secondary: null, audits };
    }
    const started = Date.now();
    const outcome = await raceWithTimeout(() => second.generate(pack), this.config.timeoutMs);
    const latencyMs = Date.now() - started;
    if (!outcome.ok) {
      audits.push({
        traceId: pack.decision.traceId,
        provider: second.id,
        model: "(compare)",
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
