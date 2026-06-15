# Pricing

## Purpose

Agent ROI does not read official provider invoices.

Instead, it estimates Codex cost from a local pricing table so that token usage can be connected to Git output and ROI-style reports.

## Price Table Source

The current Codex pricing table is maintained in:

`src/pricing/models.ts`

Source reference used for the seeded prices:

- OpenAI API pricing page

Reference URL:

- <https://openai.com/api/pricing/>

## Last Reviewed

The pricing table was last reviewed on:

- `2026-06-15`

This date should be updated whenever the seed pricing is manually reviewed or changed.

## What Estimated Cost Means

`estimated` means:

- the model was recognized
- a local price entry existed
- cost was calculated from token usage and per-model pricing

This is good enough for comparative ROI analysis, but it may differ from the final provider billing amount.

Reasons for difference may include:

- provider-side pricing changes
- pricing tier differences
- billing rules not represented in the local table
- session fields that do not map one-to-one to final invoice logic

## unknown_model

If Agent ROI cannot find a pricing entry for a Codex model:

- `cost_usd = null`
- `cost_source = unknown_model`

This is intentional.

The CLI prefers to surface missing price coverage clearly instead of inventing a cost number.

## Release Guidance

Before a new release, review:

1. the seeded model names
2. the per-million token prices
3. the review date in this document

If price coverage is incomplete, reports should continue to label it clearly rather than silently estimating with fallback guesses.
