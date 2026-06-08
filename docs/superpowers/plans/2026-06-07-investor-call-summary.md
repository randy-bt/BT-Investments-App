# Investor Call Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send investor-side call audio through an investor-framed summary prompt instead of the seller-framed one, while leaving the seller side unchanged.

**Architecture:** Add one new prompt export `INVESTOR_CALL_SUMMARY_PROMPT` to `src/lib/prompts/call-summary.ts` and one pure helper `pickSummaryPrompt({ entityType, fileName })`. Wire the existing `/api/summarize` route to call the helper instead of doing inline prompt selection, and relabel the metadata-context block based on `entityType`.

**Tech Stack:** Next.js App Router API route, Anthropic SDK (Sonnet 4.6), Vitest. Spec: `docs/superpowers/specs/2026-06-07-investor-call-summary-design.md`.

---

## File Structure

**Modify:**
- `src/lib/prompts/call-summary.ts` — add `INVESTOR_CALL_SUMMARY_PROMPT` + `pickSummaryPrompt` helper (both exported)
- `src/app/api/summarize/route.ts` — replace lines 121-132 (prompt-selection + metadata-context block) to use `pickSummaryPrompt` and an entity-aware context label

**Create:**
- `src/__tests__/lib/prompts/call-summary.test.ts` — tests for `pickSummaryPrompt` (and verifies all three prompt constants are exported with non-empty content)

---

## Scope deviation from spec

The spec says to "fetch the company name for investors" in the metadata context. **The plan does NOT do this** — YAGNI. The route already receives `leadName` (which the existing caller in `src/components/ActivityFeed.tsx:525` passes as the entity's display name for both leads and investors). Fetching `company` from the DB adds a query + error handling for marginal benefit — Randy can ask for it later if needed.

Practical effect: the metadata block becomes either `## LEAD CONTEXT` with `Name` + optional `Address`, or `## INVESTOR CONTEXT` with `Name` only (no Address line). No new DB query.

---

## Task 1: Add `INVESTOR_CALL_SUMMARY_PROMPT` + `pickSummaryPrompt` helper

**Files:**
- Modify: `src/lib/prompts/call-summary.ts`
- Create: `src/__tests__/lib/prompts/call-summary.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/prompts/call-summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CALL_SUMMARY_PROMPT,
  FOLLOW_UP_SUMMARY_PROMPT,
  INVESTOR_CALL_SUMMARY_PROMPT,
  pickSummaryPrompt,
} from '@/lib/prompts/call-summary'

describe('summary prompt constants', () => {
  it('CALL_SUMMARY_PROMPT exists and is non-empty', () => {
    expect(typeof CALL_SUMMARY_PROMPT).toBe('string')
    expect(CALL_SUMMARY_PROMPT.length).toBeGreaterThan(50)
  })

  it('FOLLOW_UP_SUMMARY_PROMPT exists and is non-empty', () => {
    expect(typeof FOLLOW_UP_SUMMARY_PROMPT).toBe('string')
    expect(FOLLOW_UP_SUMMARY_PROMPT.length).toBeGreaterThan(50)
  })

  it('INVESTOR_CALL_SUMMARY_PROMPT exists, is non-empty, and frames calls as investor-side', () => {
    expect(typeof INVESTOR_CALL_SUMMARY_PROMPT).toBe('string')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.length).toBeGreaterThan(50)
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).toContain('investor')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).not.toContain('asking price')
    expect(INVESTOR_CALL_SUMMARY_PROMPT.toLowerCase()).not.toContain('seller')
  })
})

describe('pickSummaryPrompt', () => {
  it('returns INVESTOR_CALL_SUMMARY_PROMPT for entityType=investor regardless of filename', () => {
    const onboarding = '4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3'
    const followUp = '4.5 Ann Hughes.webm'
    expect(pickSummaryPrompt({ entityType: 'investor', fileName: onboarding })).toBe(
      INVESTOR_CALL_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'investor', fileName: followUp })).toBe(
      INVESTOR_CALL_SUMMARY_PROMPT,
    )
  })

  it('returns CALL_SUMMARY_PROMPT for entityType=lead with an onboarding-style filename (>=3 " - " separators)', () => {
    const fileName = '4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3'
    expect(pickSummaryPrompt({ entityType: 'lead', fileName })).toBe(CALL_SUMMARY_PROMPT)
  })

  it('returns FOLLOW_UP_SUMMARY_PROMPT for entityType=lead with a non-onboarding filename', () => {
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: '4.5 Ann Hughes.webm' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: 'recording.mp3' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
    expect(pickSummaryPrompt({ entityType: 'lead', fileName: '4.5 - A - B.mp3' })).toBe(
      FOLLOW_UP_SUMMARY_PROMPT,
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/groovehouseent/Desktop/Bt Investments App Development/bt-investments"
npm run test -- call-summary.test.ts
```

Expected: FAIL — `INVESTOR_CALL_SUMMARY_PROMPT` and `pickSummaryPrompt` are not exported yet.

- [ ] **Step 3: Add the new export + helper to `call-summary.ts`**

Open `src/lib/prompts/call-summary.ts`. Append the following at the end of the file (after the existing `FOLLOW_UP_SUMMARY_PROMPT` declaration):

```ts

/**
 * Prompt for summarizing call transcripts on the DISPOSITIONS side — i.e.
 * calls with investors (buyers / capital partners), not property sellers.
 *
 * Used by /api/summarize when entityType === 'investor'. Independent of
 * the onboarding-vs-follow-up filename heuristic — one prompt for all
 * investor calls because they're too varied to bucket cleanly.
 *
 * Output: bullets only. No hashtags. The investor record has no
 * structured hashtag fields to map to (no INVESTOR_HASHTAG_FIELDS in
 * the codebase).
 */
export const INVESTOR_CALL_SUMMARY_PROMPT = `You are analyzing call transcripts for a real estate dispositions company (BT Investments).

Calls on this side are with INVESTORS — buyers and potential capital partners — NOT property sellers. Our goal in these calls is to understand what they want to buy, how they finance and close, and what specific deals interest them so we can match inventory to investor appetite.

---

## OBJECTIVE

Summarize what was discussed on the call in concise bullet points. Faithfully capture what the investor said.

Only include information that was explicitly stated in the call. Never assume or infer missing details.

---

## SURFACE THESE WHEN THEY COME UP

Not every call covers all of these — only include bullets for what was actually discussed:

- Buy box — geography (cities, neighborhoods), property type (SFR, multifamily, commercial, land), price range, size (beds/baths or units), condition tolerance (turnkey, light rehab, heavy rehab, tear-down)
- Capital and financing posture — cash on hand, financing approach (all-cash, conventional, hard money, JV, syndication), how fast they can close, proof-of-funds situation
- Strategy and deal type — flip, BRRRR, buy-and-hold rental, wholesale, new construction; active vs. passive; deal volume they want
- Specific properties discussed and their reaction — addresses we pitched, level of interest (interested / pass / want more info / made an offer), offer terms if any
- Relationship / context — referral source, past deals together, who else they work with
- Next steps and follow-ups

---

## WHAT TO IGNORE

- Small talk and filler
- Repeated back-and-forth with no new info
- The agent's pitch (unless the investor reacts meaningfully)
- Questions that were not answered

---

## OUTPUT FORMAT

Return ONLY bullet points. Nothing else — no headers, no labels, no hashtags.

- Use the • character for every bullet
- One idea per bullet
- No fluff or extra wording
- Do NOT include the investor's name or company in the output
- If the call was short or thin, output very few bullets — don't pad

---

## RULES

- Never assume or fill in gaps
- If unclear or cut off, say so
- Do not combine multiple ideas in one bullet
- Do not add opinions, advice, or strategy recommendations
- Same prompt is used for first calls and follow-ups — don't flag missing info like "no buy box discussed"`

/**
 * Picks the right summary prompt for a given entity + filename.
 *
 * - Investor: always INVESTOR_CALL_SUMMARY_PROMPT.
 * - Lead with onboarding-style filename (>= 3 " - " separators):
 *   CALL_SUMMARY_PROMPT.
 * - Lead with non-onboarding filename: FOLLOW_UP_SUMMARY_PROMPT.
 *
 * Pure function — no I/O. The route layer is responsible for calling
 * this with the entity type + the attachment's file_name.
 */
export function pickSummaryPrompt(opts: {
  entityType: 'lead' | 'investor'
  fileName: string
}): string {
  if (opts.entityType === 'investor') return INVESTOR_CALL_SUMMARY_PROMPT
  const isOnboarding = (opts.fileName.match(/ - /g) || []).length >= 3
  return isOnboarding ? CALL_SUMMARY_PROMPT : FOLLOW_UP_SUMMARY_PROMPT
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- call-summary.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "call-summary" || echo "no errors in call-summary"
```

Expected: no errors in `call-summary.ts` or `call-summary.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prompts/call-summary.ts src/__tests__/lib/prompts/call-summary.test.ts
git commit -m "Summary: add investor prompt + pickSummaryPrompt helper"
```

---

## Task 2: Wire the route to use `pickSummaryPrompt` + entity-aware context label

**Files:**
- Modify: `src/app/api/summarize/route.ts`

- [ ] **Step 1: Update the imports in `route.ts`**

Open `src/app/api/summarize/route.ts`. Find the existing import on line 5:

```ts
import { CALL_SUMMARY_PROMPT, FOLLOW_UP_SUMMARY_PROMPT } from '@/lib/prompts/call-summary'
```

Replace it with:

```ts
import { pickSummaryPrompt } from '@/lib/prompts/call-summary'
```

(The constants are no longer referenced directly in the route — they're only used through the helper.)

- [ ] **Step 2: Replace the prompt-selection + metadata-context block**

Find the block at lines 121-132 in `route.ts`:

```ts
    // 5. Auto-detect prompt based on filename format
    // Onboarding files: "4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3"
    // Follow-up files: "4.5 Ann Hughes.webm" or similar (no " - " separators)
    const isOnboarding = (attachment.file_name.match(/ - /g) || []).length >= 3
    const basePrompt = isOnboarding ? CALL_SUMMARY_PROMPT : FOLLOW_UP_SUMMARY_PROMPT

    let metadataContext = ''
    if (leadName || leadAddress) {
      metadataContext = '\n\n---\n\n## LEAD CONTEXT\n\n'
      if (leadName) metadataContext += `Name: ${leadName}\n`
      if (leadAddress) metadataContext += `Address: ${leadAddress}\n`
    }
```

Replace it with:

```ts
    // 5. Pick the prompt based on entity type (and filename for leads).
    const basePrompt = pickSummaryPrompt({ entityType, fileName: attachment.file_name })

    let metadataContext = ''
    if (leadName || leadAddress) {
      const contextLabel = entityType === 'investor' ? 'INVESTOR CONTEXT' : 'LEAD CONTEXT'
      metadataContext = `\n\n---\n\n## ${contextLabel}\n\n`
      if (leadName) metadataContext += `Name: ${leadName}\n`
      // Address only applies to leads — investors don't have a property address.
      if (entityType === 'lead' && leadAddress) metadataContext += `Address: ${leadAddress}\n`
    }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "summarize/route" || echo "no errors in route"
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
npm run test
```

Expected: existing tests pass. Pre-existing failure in `investors.test.ts` is unrelated — leave it.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/summarize/route.ts
git commit -m "Summary: route picks investor-vs-lead prompt by entityType"
```

---

## Task 3: Manual verification

**Goal:** Confirm end-to-end that an investor audio file produces an investor-framed summary, and a lead audio file still produces the existing seller-framed summary.

- [ ] **Step 1: Push to deploy (or test locally)**

Either:

```bash
git push origin main
```

(triggers Vercel deploy), or

```bash
npm run dev
```

and test against `http://localhost:3000`.

- [ ] **Step 2: Summarize an investor audio file**

1. Open an existing investor record at `/app/dispositions/investor-record/<id>`.
2. Find an existing audio attachment in the activity feed, or upload one.
3. Click the Summarize action.
4. Wait for the summary to appear in the feed.

**Expect:**
- The summary is bullet-style with `•` markers.
- It frames the content from the investor's perspective — buy box, capital, strategy, etc. — not "seller's willingness to sell" or "asking price".
- There is NO hashtags block at the end (no `#asking_price`, etc.).
- The audio gets the "already summarized" marker — clicking Summarize again on the same audio returns the existing 409.

- [ ] **Step 3: Summarize a lead audio file (regression check)**

1. Open an existing lead record at `/app/acquisitions/lead-record/<id>`.
2. Find or upload an audio attachment.
3. Click Summarize.

**Expect:**
- The summary still uses the existing seller framing — "seller's willingness", "asking price", etc.
- Hashtags block is still present at the end for any structured fields the call confirmed.
- No regression from today's behavior.

- [ ] **Step 4: Confirm the metadata-context block label changed**

Optional but useful — temporarily add a `console.log(fullPrompt)` near the Anthropic call (line 145 of `route.ts`) and re-run a summary on both an investor and a lead. The investor run should log `## INVESTOR CONTEXT` with only `Name`. The lead run should log `## LEAD CONTEXT` with `Name` (and `Address` if it was passed). Remove the log before committing anything else.

---

## Self-Review

**1. Spec coverage:**
- New `INVESTOR_CALL_SUMMARY_PROMPT` in `call-summary.ts` → Task 1
- `pickSummaryPrompt` helper → Task 1
- Route wires `pickSummaryPrompt` instead of inline selection → Task 2
- Metadata-context block uses `INVESTOR CONTEXT` for investors → Task 2
- Address line suppressed for investors → Task 2
- Unit tests for `pickSummaryPrompt` covering all three branches → Task 1
- Manual verification → Task 3
- Scope deviation noted (no DB fetch for `company`) — covered above the tasks, intentional, not a gap.

**2. Placeholder scan:** No TBD, no "implement later", every step has complete code and exact commands. ✓

**3. Type consistency:**
- `pickSummaryPrompt({ entityType: 'lead' | 'investor'; fileName: string }): string` — same signature in Task 1 test, Task 1 implementation, and Task 2 route call. ✓
- `INVESTOR_CALL_SUMMARY_PROMPT` exported as `string` const, referenced as `string` in test. ✓
- Route's existing `entityType` typing (`'lead' | 'investor'`) carries through to the helper call unchanged. ✓

Plan is internally consistent.
