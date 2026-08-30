# Switch Almail AI to a cheap Gemini model so credits drain slowly

## Why it keeps running out

Almail AI (player/fixture extraction) and the Arabic translation service both hardcode the most expensive model in the catalog — `openai/gpt-5.6-sol`:

- `src/lib/almail-ai.server.ts:51` → `model: provider("openai/gpt-5.6-sol")`
- `src/lib/translate.server.ts:40` → `model: provider("openai/gpt-5.6-sol")`

Every call goes through the Lovable AI Gateway (`ai.gateway.lovable.dev`) authenticated with `LOVABLE_API_KEY`, which bills the **same single workspace credit pool** — there is no separate or free Gemini path. `gpt-5.6-sol` is the priciest model, so the monthly 100 credits burn out in a handful of batch-import runs. That's why it says "out of credits."

## The fix

Swap both call sites to a cheap Gemini model that still reads photos (player extraction, fixture photos) and does Arabic translation well, but costs a small fraction as much. Same gateway, same credit pool — just drained ~10–30× slower.

- **Extraction (images + text)** → `google/gemini-3.5-flash` — supports image input, strong enough to read player lists and fixture photos, very low cost.
- **Translation (text only)** → `google/gemini-3.1-flash-lite` — the cheapest text model in the catalog; perfect for high-volume string translation.

Both are in the project's available-models list (no extra API key needed).

## Changes

1. **`src/lib/almail-ai.server.ts`** — change the model to `google/gemini-3.5-flash` and **remove** the `providerOptions: { lovable: { reasoningEffort: "none" } }` line (that option is GPT-5.6-only; Gemini ignores it and it's cleaner to drop it). Keep everything else (image content building, JSON parsing, error descriptions) unchanged.

2. **`src/lib/translate.server.ts`** — change the model to `google/gemini-3.1-flash-lite` and remove the same `reasoningEffort` providerOption. Caching logic stays as-is.

3. **Verify** — after the switch, run one real extraction call and one real translation call through the route and read the response to confirm the Gemini model accepts the request shape (no 400). Credit cost should be a small fraction of the old per-call cost.

## What this does NOT do

- It does **not** add credits — that is a billing action only you can do in **Settings → Plans & credits**. With the balance at 0, AI calls stay blocked until credits are topped up or the monthly/daily reset lands.
- It does **not** change chat moderation (already uses a cheap Gemini model) or any other feature.
- It does **not** touch the gateway setup, auth, or any database logic.

Once credits are back, the same Almail AI features run exactly the same way — just consuming far fewer credits each time.
