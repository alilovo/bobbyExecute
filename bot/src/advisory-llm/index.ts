/**
 * Advisory-only LLM — isolated from trading hot path and package root.
 * Import: `@onchain-trading-bot/core/advisory-llm`
 *
 * OFF by default (`ADVISORY_LLM_ENABLED` !== `true`). No boot dependency when unused.
 */
export type {
  AdvisoryEvidencePack,
  AdvisoryLLMResponse,
  AdvisoryLLMProvider,
  AdvisoryCallAuditLog,
  DecisionEnvelopeV3,
} from "./types.js";
export { AdvisoryLLMResponseSchema, parseAdvisoryLLMResponse } from "./schema.js";
export { buildAdvisoryPrompt } from "./prompt-builder.js";
export { OpenAIAdvisoryProvider } from "./providers/openai.js";
export { XaiAdvisoryProvider } from "./providers/xai.js";
export {
  AdvisoryLLMService,
  createAdvisoryLLMService,
  readAdvisoryLLMConfigFromEnv,
  isDecisionEnvelopeV3,
} from "./service.js";
