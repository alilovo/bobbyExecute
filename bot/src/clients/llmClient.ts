/**
 * LLM Client - XAI / OpenAI with LAUNCH_MODE fallback.
 *
 * Provider-Wahl:
 * - LAUNCH_MODE === "openai" oder "openai_fallback" → OpenAI (oder OPENAI_BASE_URL)
 * - sonst, wenn XAI_API_KEY gesetzt → x.ai
 * - andernfalls → OpenAI (oder OPENAI_BASE_URL)
 */
import OpenAI from "openai";

type LlmProvider = "xai" | "openai";

const hasXaiKey = !!process.env.XAI_API_KEY;
const launchMode = process.env.LAUNCH_MODE;

const currentProvider: LlmProvider = (() => {
  if (launchMode === "openai" || launchMode === "openai_fallback") {
    return "openai";
  }
  if (hasXaiKey) {
    return "xai";
  }
  return "openai";
})();

const isXaiMode = currentProvider === "xai";

let client: OpenAI;

if (isXaiMode) {
  client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
} else {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  });
}

const DEFAULT_SYSTEM_PROMPT =
  process.env.LLM_SYSTEM_PROMPT ?? "You are a helpful assistant.";
const CANNED_FALLBACK =
  process.env.LLM_CANNED_FALLBACK ??
  "[Response unavailable]";

const DEFAULT_XAI_MODEL = process.env.XAI_MODEL_PRIMARY ?? "grok-beta";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const currentModel = isXaiMode ? DEFAULT_XAI_MODEL : DEFAULT_OPENAI_MODEL;

export { client, isXaiMode, currentProvider, currentModel };

/**
 * Generate LLM response with optional model override.
 * Falls back to canned response on error.
 */
export async function generateResponse(
  prompt: string,
  options: { model?: string; systemPrompt?: string } = {}
): Promise<string> {
  const model = options.model ?? currentModel;
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.92"),
      max_tokens: parseInt(process.env.LLM_MAX_TOKENS ?? "280", 10),
    });
    return completion.choices[0].message.content?.trim() ?? "";
  } catch (err) {
    console.error(`LLM error (${currentProvider}/${model}):`, err);
    return CANNED_FALLBACK;
  }
}
