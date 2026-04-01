/**
 * OpenAI advisory provider — optional; only invoked when advisory service calls it.
 */
import OpenAI from "openai";
import { buildAdvisoryPrompt } from "../prompt-builder.js";
import { parseAdvisoryLLMResponse } from "../schema.js";
import type { AdvisoryEvidencePack, AdvisoryLLMProvider, AdvisoryLLMResponse } from "../types.js";

export class OpenAIAdvisoryProvider implements AdvisoryLLMProvider {
  readonly id = "openai" as const;

  constructor(
    private readonly options: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      maxTokens: number;
    }
  ) {}

  async generate(pack: AdvisoryEvidencePack): Promise<AdvisoryLLMResponse> {
    const client = new OpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl ?? "https://api.openai.com/v1",
    });
    const prompt = buildAdvisoryPrompt(pack);
    const completion = await client.chat.completions.create({
      model: this.options.model,
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON for advisory documentation. Never change or reinterpret authority fields.",
        },
        {
          role: "user",
          content: `${prompt}\n\nEcho provider as "openai" and model as "${this.options.model}" in your JSON.`,
        },
      ],
      max_tokens: this.options.maxTokens,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error("ADVISORY_OPENAI_JSON_PARSE");
    }
    const base = parseAdvisoryLLMResponse(parsed);
    if (!base) {
      throw new Error("ADVISORY_OPENAI_SCHEMA");
    }
    return {
      ...base,
      provider: "openai",
      model: this.options.model,
    };
  }
}
