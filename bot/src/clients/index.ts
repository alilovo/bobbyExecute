/**
 * Clients - canonical exports for external service integrations.
 * LLM: use llmClient (generateResponse) for all LLM calls.
 */
export {
  client,
  isXaiMode,
  currentProvider,
  currentModel,
  generateResponse,
} from "./llmClient.js";
