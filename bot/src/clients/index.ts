/**
 * Clients - canonical exports for external service integrations.
 * LLM: use generateResponse for all LLM calls.
 */
export { client, isXaiMode, currentProvider, currentModel } from "./llmClient.js";
export { generateResponse } from "./fallbackCascade.js";
