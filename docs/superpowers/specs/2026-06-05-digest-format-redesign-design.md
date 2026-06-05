# Daily Digest — Format & Trigger Redesign

**Status:** Approved design, ready for implementation plan
**Date:** 2026-06-05
**Owner:** Randy (personal-use feature inside BT Investments app)

## Goal

The Daily Digest at `/app/digest` synthesizes Randy's newsletter inbox into a single card. Today the card is dense prose grouped by topic — it captures everything but takes too long to scan. Randy wants the output to feel like The Rundown or Superhuman: bullets, spacing, scannable in 2-3 minutes.

Bundled into the same change: switch the build trigger from a daily cron to a manual "Build now" button with a "since last build" window, so Randy never misses content if he skips a day and the tool doesn't burn API credits building digests he never reads.

## Scope

In scope:
- Visual layout redesign of the digest card.
- LLM prompt and output-shape redesign to support the new layout.
- Trigger change: remove the daily Vercel cron, switch to manual-only with "since last build" window logic.
- Backward compatibility: old text-only digests continue rendering correctly.

Out of scope:
- Changes to the newsletter source list.
- Changes to the IMAP fetcher's email parsing logic.
- Changes to the "Digested" Gmail labeling behavior (still happens, just on every manual build instead of only on the cron run).

## Format & content rules

### Layout (hybrid C)

```
┌─ Card header ──────────────────────────────────────┐
│ Built Thu, Jun 4 at 3:42 PM · 7 emails             │
│                                  from past 2 days  │
├─────────────────────────────────────────────────────┤
│  [Bold one-line headline summarizing the digest]   │
│                                                     │
│  ┌─ Today's lead ─────────────────────────────┐    │
│  │ OpenAI launches o4-mini                    │    │
│  │ 2-3 sentence paragraph with substance...   │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  AI                                                 │
│  ─────────────                                      │
│  • Subject — single-sentence detail.                │
│  • Subject — single-sentence detail.                │
│                                                     │
│  Tech & Business                                    │
│  ─────────────                                      │
│  • ...                                              │
│                                                     │
│  + Show 7 sources                                   │
└─────────────────────────────────────────────────────┘
```

### Content rules

- **Headline:** Same visual treatment as today — bold one-line summary at the top of the body. Framing wording (`Today`, `Since June 1`, etc.) varies based on window length; the LLM picks.
- **Lead block:** LLM picks the single most impactful story of the window. One sentence title + one short paragraph (2-3 sentences) of context. If the LLM judges no single story stands out, lead can be `null` and the block is hidden.
- **Sections (fixed order):** `AI` → `Tech & Business` → `Markets` → `Worth knowing`. Empty sections are omitted entirely — no "no major updates" filler.
- **Items per section:** Single-sentence bullets. Format: bold subject (company/product) + em-dash + the substance. Inline numbers and specifics allowed when load-bearing ("80% lower input cost", "$5B at $80B valuation"). No nested sub-bullets.
- **Density:** LLM picks the ~8-15 stories that actually matter across all source emails. Smaller filler items are dropped. Target read time: 2-3 minutes.
- **Source attribution:** None inline. The existing "Show N sources" expander at the bottom continues to show which source emails contributed.

### Headline framing

The LLM receives the actual window start and end timestamps in its prompt. It writes the headline naturally for the window:
- Window ≈ 24h → "Today" framing acceptable.
- Window spans multiple days → "Since [date]" framing.

This is a soft guideline in the prompt, not a hard parse — the LLM has judgment over the wording.

## Trigger model

### No automatic cron

Remove the daily digest cron entry from `vercel.json`. The build endpoint stays mounted at the same path with the same auth (Randy-only on manual; `CRON_SECRET` path stays in case we re-introduce automation later, but no scheduled invocations).

### "Since last build" window

On each manual Build Now click:

1. Query `daily_digests` for the most recent row's `window_end` timestamp.
2. If found: `since = window_end`.
3. If not found (first build ever): `since = now - 24h`.
4. **Cap:** if `now - since > 7 days`, set `since = now - 7 days`. Avoids vacation-induced 30-day windows that would blow the LLM context.
5. `before = now`.

### Duplicate-click handling

If the fetched email count is 0:
- Don't write a row.
- Return `{ ok: true, emailCount: 0, message: "Nothing new since [previous build time]" }`.
- Client surfaces this in the existing build-message banner.

### Gmail labeling

Every successful build (`emailCount > 0`) labels its contributing emails as "Digested" and marks them read. This is a behavior change from today, where only cron-triggered runs labeled. Reason: with cron removed, the manual click is now the authoritative pass. Labeling is purely Gmail-side organization for Randy; it does not affect dedup logic (which uses `window_end` timestamps, not the label).

## Technical architecture

### Data model

**Migration file:** `supabase/migrations/054_digest_format_redesign.sql` (latest existing migration is `053_daily_digests.sql`).

**New columns on `daily_digests`:**

```sql
ALTER TABLE daily_digests
  ADD COLUMN body_json JSONB,                  -- structured layout payload, nullable for back-compat
  ADD COLUMN window_start TIMESTAMPTZ,         -- nullable for back-compat
  ADD COLUMN window_end TIMESTAMPTZ;           -- nullable for back-compat
```

**Drop the `digest_date` uniqueness constraint:**

Currently `daily_digests.digest_date` is declared `NOT NULL UNIQUE` inline (migration `053`, line 11), creating an implicit `daily_digests_digest_date_key` constraint. Multiple builds per day must be allowed under the new model — a duplicate-click on a busy day might still produce two distinct digests if the second click captures genuinely new emails since the first.

```sql
ALTER TABLE daily_digests DROP CONSTRAINT IF EXISTS daily_digests_digest_date_key;
```

`digest_date` stays on the row for human-readable display; sorting and identity move to `created_at`.

**Index for the new sort:**

```sql
CREATE INDEX daily_digests_created_at_idx ON daily_digests(created_at DESC);
```

The existing `daily_digests_date_idx` stays (cheap to keep, still useful for any date-based queries / the `?date=YYYY-MM-DD` backfill).

### Zod schema for `body_json`

New file `src/lib/digest/schema.ts`:

```ts
import { z } from 'zod'

export const SectionName = z.enum(['AI', 'Tech & Business', 'Markets', 'Worth knowing'])

export const DigestBodyJson = z.object({
  lead: z
    .object({
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .nullable(),
  sections: z.array(
    z.object({
      name: SectionName,
      items: z
        .array(
          z.object({
            subject: z.string().min(1),
            detail: z.string().min(1),
          }),
        )
        .min(1), // empty sections are omitted entirely, not stored
    }),
  ),
})

export type DigestBodyJson = z.infer<typeof DigestBodyJson>
```

### LLM call

`src/lib/digest/synthesize.ts` switches from free-form prose to **Anthropic tool use** to force structured JSON output:

1. Define a single tool (`return_digest`) whose `input_schema` matches `DigestBodyJson` (translated from Zod to JSON Schema).
2. Set `tool_choice` to force the tool call.
3. Parse the tool input through the Zod schema for defense-in-depth.
4. On Zod failure: one retry with the validation error appended to the user message ("Your last response failed validation: [error]. Please return valid JSON.").
5. On second Zod failure: fall back to a plain-text synthesis call (existing free-form prompt) and store `body_json = null`. Log a warning. Digest never hard-fails.

The system prompt for the structured call includes:
- The content rules (lead block, section order, ~8-15 items, single-sentence bullets, no filler sections).
- The window start/end timestamps so it can frame the headline appropriately.

Return signature:

```ts
export type DigestResult = {
  headline: string
  body: string                          // plain-text rendering (kept for back-compat + fallback storage)
  bodyJson: DigestBodyJson | null       // null when fallback path was used
  inputTokens: number
  outputTokens: number
  model: string
}
```

`body` is derived deterministically from `bodyJson` by serializing the structured payload to plain text (so the existing text-rendering code path still works, and the DB always has something readable in the `NOT NULL` `body` column for tooling/backups). Serialization shape:

```
<lead.title>
<lead.body>

AI
- <subject> — <detail>
- ...

Tech & Business
- <subject> — <detail>
...
```

(Lead block omitted if `bodyJson.lead === null`. Sections omitted if their items array is empty / not present.)

When the fallback path runs (`bodyJson === null`), `body` is whatever the plain-text Anthropic call returned, unchanged from today's behavior.

### Build route

`src/app/api/digest/build/route.ts` changes:

- Compute `since`/`before` using the "since last build" algorithm above (replaces the fixed 24-hour window).
- Apply the 7-day cap.
- After `fetchNewsletterEmails`: if `emails.length === 0`, return the "Nothing new" response without writing or calling Claude.
- After `synthesizeDigest`: write `body_json`, `window_start`, `window_end` alongside the existing columns.
- Change `.upsert(..., { onConflict: 'digest_date' })` to `.insert(...)` — each build is its own row.
- Drop the `if (auth.isCron)` guard around `labelEmailsAsDigested` — label on every successful build.
- The `?date=YYYY-MM-DD` backfill parameter is preserved (uses a fixed PST day window instead of "since last build" when present).

### Renderer

`src/app/app/digest/client.tsx` changes:

- New type field on `Digest`: `body_json: DigestBodyJson | null`, `window_start: string | null`, `window_end: string | null`.
- New component `StructuredBody` (inline in `client.tsx` or extracted to `src/components/digest/StructuredBody.tsx`) that renders the lead block + sections + bullets.
- Branch in render: `current.body_json ? <StructuredBody json={current.body_json} /> : <div className="whitespace-pre-wrap ...">{current.body}</div>`.
- Card header replaces "Thu, Jun 4 · 7 emails" with "Built [date+time] · N emails from past X days" when `window_start` and `window_end` are present; falls back to the old format for old rows.
- Carousel sort changes from `digest_date DESC` to `created_at DESC` (matching the new "one row per build" model).
- The `formatDate` helper grows a sibling that formats date+time in Randy's local timezone.

### Visual styling

Matches the existing dashed-border design system in the app (per `CLAUDE.md`). Specifically:
- Card uses the existing `rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm`.
- Section headers: small uppercase tracked label (`text-[0.65rem] uppercase tracking-wider text-neutral-500`), thin dashed underline.
- Lead block: subtle tinted background with a left accent border using the existing `#c5cca8` / `#e8edda` palette already in the build button.
- Bullets: standard list with `text-sm leading-relaxed text-neutral-700`. Subject is `font-medium text-neutral-900`.

## Failure modes

| Scenario | Behavior |
|---|---|
| LLM returns malformed tool input (Zod fail) | One retry with error context. |
| LLM fails twice | Fall back to plain-text prompt; store `body_json = null`. Digest still saves. |
| IMAP fetch throws | Existing behavior preserved — 500 returned, no row written. |
| Empty window (no new emails) | No row written, no Claude call. Return `emailCount: 0` message. |
| User clicks Build twice rapidly | First click writes a row; second sees `window_end = first row's timestamp`, fetches an empty window, returns "Nothing new". |
| Vacation — 30 days between clicks | 7-day cap kicks in: only the last 7 days' newsletters synthesized. |
| Old digest (pre-migration) viewed in carousel | Renders via text fallback path. Header uses old format. |
| Gmail labeling fails post-synthesis | Non-fatal. Digest already saved. Log and continue (existing behavior). |

## Testing

Tests live under `src/__tests__/` (per `CLAUDE.md`). New files:

- **`schema.test.ts`** — `DigestBodyJson` accepts a valid sample; rejects missing `name`, invalid section name, empty `subject`, missing `lead` key entirely.
- **`synthesize.test.ts`**:
  - Happy path: mocked Anthropic response with valid tool input → returns parsed `bodyJson` and a derived `body`.
  - Retry path: first response malformed, second valid → retry occurs, returns the valid response, only 2 Anthropic calls.
  - Fallback path: both structured attempts malformed → falls back to plain-text synthesis call, returns `bodyJson: null`, non-empty `body`.
- **`window.test.ts`** (route-level or extracted helper):
  - No prior digest → window = `[now - 24h, now)`.
  - Prior digest with `window_end = T` → new window = `[T, now)`.
  - Prior digest with `window_end = now - 10d` → 7-day cap kicks in.

Existing tests covering the IMAP fetcher and route auth stay green — only their fixtures may need a `body_json` field added.

## Manual verification (after deploy)

1. Click "Build now" on `/app/digest`.
2. Confirm the new card renders the structured layout: bold headline, lead block, sectioned bullets.
3. Click an older pre-migration digest in the carousel → confirm it still renders via the text fallback.
4. Click "Build now" again immediately → confirm "Nothing new since [time]" message and no new row.
5. Verify in Gmail that the source emails for the new build now have the "Digested" label.
6. Spot-check the structured output reads like the mockup approved during brainstorming (bold subjects, single-line bullets, no filler sections).

## Rollout

Single deploy:
1. Run the migration (additive — nullable columns + dropped unique constraint).
2. Deploy the code changes.
3. Remove the cron entry from `vercel.json` in the same deploy.
4. First manual build post-deploy uses `now - 24h` as the window (no prior `window_end`). All subsequent builds use "since last build".

No feature flag needed. Backward compatibility is handled by the renderer's branch on `body_json`.

## Open questions / future work

- **Mobile rendering polish** — current digest page works on mobile but hasn't been audited against the new bullet-heavy layout. Worth a manual check after first real build.
- **Backfill option** — `?date=YYYY-MM-DD` already exists. It will now also produce a structured digest, but uses the fixed PST day window. No change needed; just noted.
- **DST handoff** — the memory mentions a planned cron timing bump in Nov 2026. Removing the cron makes that moot. Update the memory once this ships.
