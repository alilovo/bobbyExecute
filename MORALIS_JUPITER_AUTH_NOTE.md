# Moralis / Jupiter Auth Note

- Set `MORALIS_API_KEY` in Render service env vars for paper/live deployments, or in local `.env` for private testing.
- Set `JUPITER_API_KEY` in Render service env vars for live deployments, or in local `.env` for private testing.
- `MORALIS_API_KEY` is the Moralis Data API key used by `bot/src/adapters/moralis/client.ts` and sent as `X-Api-Key`.
- `JUPITER_API_KEY` is the Jupiter quote/swap API key used by `bot/src/adapters/dex-execution/quotes.ts` and `swap.ts`, sent as `x-api-key`.
- Local dev with stub/dry paths does not require either key.
- Paper mode requires `MORALIS_API_KEY` when the paper runtime uses live Moralis-backed wallet snapshot or balance calls.
- Paper mode does not currently require `JUPITER_API_KEY` because Jupiter quote/swap calls are only on the live execution path.
- Live mode requires both keys for real adapter-backed ingest and execution.
