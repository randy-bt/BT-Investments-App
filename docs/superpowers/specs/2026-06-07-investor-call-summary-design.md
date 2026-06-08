# Investor Call Summary — Design

**Status:** Approved, proceed to implementation plan
**Date:** 2026-06-07

## Goal

Audio summaries on the dispositions side currently use the seller-framed `CALL_SUMMARY_PROMPT` / `FOLLOW_UP_SUMMARY_PROMPT` from `src/lib/prompts/call-summary.ts`. Those prompts assume the caller is a property seller (extracting "asking price", "willingness to sell", "property condition", etc.). On the dispositions side we're talking to **investors**, where none of that maps. Need a separate prompt that reflects what an investor call actually contains.

## Out of scope

- Adding structured hashtag fields on the investor record. The seller-side hashtags (`#asking_price`, etc.) map to lead-record columns; the investor record has no equivalent column set (no `INVESTOR_HASHTAG_FIELDS` exists in the codebase). If we later want structured investor tags, that's a separate feature.
- Splitting onboarding-vs-follow-up for investors. The seller side splits because intake/onboarding has a checklist to flag gaps against; investor calls are too varied for that, so we use one prompt for all investor calls regardless of filename format.
- Changes to transcription (OpenAI Whisper) or the route's auth, attachment loading, or DB-update path. All unchanged.

## Design

### One new prompt

`INVESTOR_CALL_SUMMARY_PROMPT`, added to `src/lib/prompts/call-summary.ts` alongside the two existing seller prompts. Same style — `•`-bullet output, no markdown, terse, faithful-to-transcript, no assumptions.

**Frame:** investor calls (not seller calls). Goal is matching inventory to investor appetite.

**Surface IF discussed** (not required sections):
1. Buy box — geography, asset type, price range, size, condition tolerance
2. Capital and financing posture — cash, financing approach, close speed, POF
3. Strategy and deal type — flip / BRRRR / hold / wholesale / new build; active vs. passive; deal volume
4. Specific properties discussed and reactions — addresses we pitched + interest level
5. Relationship / context — referral source, past deals, partners
6. Next steps and follow-ups

**Output:** bullets only, no hashtags, no headers, no labels. Don't pad if the call was thin.

**Rules:** never assume / infer; no opinions; one idea per bullet; works for first call AND follow-ups (no "no buy box discussed" gap flags).

### Route wiring

`src/app/api/summarize/route.ts` already accepts `entityType: 'lead' | 'investor'`. Currently it picks the prompt by filename format only. Change to branch on entityType first:

```ts
let basePrompt: string
if (entityType === 'investor') {
  basePrompt = INVESTOR_CALL_SUMMARY_PROMPT
} else {
  const isOnboarding = (attachment.file_name.match(/ - /g) || []).length >= 3
  basePrompt = isOnboarding ? CALL_SUMMARY_PROMPT : FOLLOW_UP_SUMMARY_PROMPT
}
```

**Extract a pure helper** `pickSummaryPrompt({ entityType, fileName })` into a new file (or inline-export from `call-summary.ts`) so the selection logic is unit-testable. The route imports + calls the helper.

### Metadata context

The current route prepends a `## LEAD CONTEXT` block with `Name` and `Address` fetched from the lead record. For investors there's no property address; the context block should be `## INVESTOR CONTEXT` with `Name` and (optionally, if present in DB) `Company`. Conditional branching in the route by `entityType`.

## Files to create / modify

**Modify:**
- `src/lib/prompts/call-summary.ts` — add `INVESTOR_CALL_SUMMARY_PROMPT` export + `pickSummaryPrompt` helper
- `src/app/api/summarize/route.ts` — replace the prompt-selection block with the helper call; branch the metadata context block on entityType (fetch company name for investors)

**Create:**
- `src/__tests__/lib/prompts/call-summary.test.ts` — tests for `pickSummaryPrompt`:
  - `entityType: 'investor'` → returns `INVESTOR_CALL_SUMMARY_PROMPT` regardless of filename
  - `entityType: 'lead'` + onboarding-style filename → returns `CALL_SUMMARY_PROMPT`
  - `entityType: 'lead'` + non-onboarding filename → returns `FOLLOW_UP_SUMMARY_PROMPT`

## Manual verification

1. Upload an audio file to a lead record → run "Summarize" → confirm output looks like seller-summary today (unchanged).
2. Upload an audio file to an investor record → run "Summarize" → confirm output is bullet-format, no hashtags, framed around the investor's interests/capital/etc., not asking-price/seller-willingness.
3. Spot-check the metadata-context block in the prompt: investor record has "## INVESTOR CONTEXT" with Name (and Company if set), no Address line.

## Rollout

Single deploy. No DB migration. Backwards compatible — existing seller summaries unchanged.
