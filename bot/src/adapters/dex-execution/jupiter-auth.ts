/**
 * Jupiter auth helpers shared by quote and swap requests.
 */
const JUPITER_API_KEY_ENV = "JUPITER_API_KEY";
const JUPITER_API_KEY_HEADER = "x-api-key";

function readJupiterApiKey(): string {
  const apiKey = process.env[JUPITER_API_KEY_ENV]?.trim();
  if (!apiKey) {
    throw new Error(
      "Jupiter API key missing: set JUPITER_API_KEY to use Jupiter quote and swap requests."
    );
  }
  return apiKey;
}

export function buildJupiterAuthHeaders(): Record<string, string> {
  return {
    [JUPITER_API_KEY_HEADER]: readJupiterApiKey(),
  };
}
