# Indica AI — Design

**Status:** Approved, proceed to implementation plan
**Date:** 2026-06-10

## Goal

Add a per-record AI chat assistant ("Indica") to every lead and investor page. Randy and Aldo can ask questions and get cited, concise answers grounded in everything the record holds — scalar fields, activity feed notes, AI summaries, attachment file names, and the verbatim call transcripts saved by Phase 1.

Indica unblocks the class of questions that summaries lose: *"Did Thomas mention what he wants to do with the money?"* *"Did the seller bring up the back deck?"* *"Has Aldo noted anything about the tenant situation that the activity feed doesn't capture?"*

## Out of scope

- Cross-record knowledge — Indica only sees the current record's data. Hard boundary.
- Photo / PDF content recognition — Indica sees attachment file names, not pixels or document text.
- Indica taking actions on the record (writing notes, changing status, etc.) — read-only assistant for v1.
- Streaming responses — nice-to-have, deferred. v1 returns the full reply at once.
- Mobile-specific polish beyond responsive defaults.
- Exposing the chat or transcripts to non-admin users.

## Personality and behavior

Encoded in the system prompt:

- **Honesty is paramount.** If the answer isn't in the record or transcripts, Indica says *"I don't have anything on that"*. Adjacent/tangential info can be surfaced as such, but never as a fake answer. No guessing. No fabricated quotes.
- **Concise and digestible.** Short answers. No padding. The conversational rhythm matters more than thoroughness.
- **Mostly reactive.** Answers what's asked. Doesn't volunteer strategic advice.
- **Occasionally flags genuinely important things** at the end of an answer (a contradiction in the record, a previously-mentioned issue never followed up on). Sparingly — not on every message.
- **Cites sources** — every claim points back: *"From the May 12 call: Thomas said he wants to close fast."* / *"Per Aldo's May 14 note: occupancy is owner-occupied."*
- **Addresses the asker by name** — *"Randy, the timeline is…"* / *"Aldo, the asking price is…"*

## Scope of knowledge

Indica's context is built fresh on every message ("live refresh"). It includes:

1. **All scalar lead/investor fields** — name, address, phones, emails, status, dates, prices, condition, occupancy, follow-up date, etc.
2. **All activity feed updates** — every `updates` row including AI summaries, hand-typed notes, status changes, follow-up triggers.
3. **All attachments** — file names only (e.g. "5.12 Thomas Kayser.m4a"), not contents.
4. **All call transcripts** — full text from `call_transcripts` rows for this record's audio attachments.
5. **The full Indica chat history for this record** — every prior message from Randy, Aldo, and Indica.

Indica does **not** see:
- Other leads or investors (scope boundary).
- Photo or PDF binary contents.
- Anything from other records' transcripts, even if a similar lead is discussed in this record's calls.

## First-open backfill flow

The Indica chat panel detects audio attachments that don't yet have a `call_transcripts` row (i.e. they were summarized before Phase 1 shipped, or backfill never ran for this record).

1. User clicks the floating Indica button.
2. Backend `GET /api/indica/status` returns `{ needsBackfill: true, missingCount: 4 }`.
3. Panel opens with a confirmation popup:
   > **Indica needs to transcribe 4 prior recordings before we can chat.** This takes ~30s per recording.
   > **[Continue] [Cancel]**
4. On **Continue**:
   - Panel shows a progress bar: *"Transcribing 2 of 4…"*
   - Below the progress bar: small disclaimer text *"Do not close this tab until complete."*
   - Backend `POST /api/indica/backfill-transcripts` runs Whisper on each missing attachment, inserts a `call_transcripts` row per success.
5. When done → progress bar disappears, chat input is enabled, Indica posts a greeting message.
6. If transcription fails for an attachment (corrupted audio, etc.), it's silently skipped. Chat opens with a footer note: *"1 recording couldn't be transcribed and isn't available to Indica."*
7. On **Cancel** → panel closes; no state changes; popup reappears on next open.
8. On all future opens (no missing transcripts) → no popup; chat opens directly.

New audio added after the first backfill gets transcribed automatically by Phase 1's behavior (summarize-time persistence). So once backfill has run for a record, it should never reappear.

## UI

**Floating button:**
- Position: fixed, bottom-right, with safe-area inset for mobile.
- Shape: circle, ~56px on desktop, ~48px on mobile.
- Color: `#5D3954` (deep aubergine plum). Hover/active states slightly darker.
- Icon: small sparkle (the universal "AI" cue), white on plum.
- Subtle shadow. No badge or notification dot in v1.
- Appears on `/app/acquisitions/lead-record/[id]` and `/app/dispositions/investor-record/[id]`.

**Chat panel:**
- Opens as a popup anchored to the floating button. Right-aligned, takes the right ~25% of the viewport on desktop; full-width slide-up on mobile.
- Header: "Indica" with a close X.
- Body: scrollable message list, newest at the bottom.
- Footer: text input + send button. Disabled during backfill or while a message is in flight.

**Message bubble colors:**
- **Indica**: plum bubble (`#5D3954` background, white text — matches the button).
- **Randy's messages**: gold/yellow bubble (matches the existing lead-record update color — `#fbf3c9` or whatever the activity-feed yellow uses).
- **Aldo's messages**: gray bubble (`#e5e5e5` background, dark text).
- Author name labeled above each bubble (e.g. "Randy", "Aldo"). Indica's bubble doesn't need a name label (its identity is clear from color).
- Indica bubbles left-aligned. User bubbles right-aligned.

## Model + prompt caching

- **Model:** `claude-sonnet-4-6` (matches the rest of the app's LLM workloads).
- **Prompt caching:** the static parts of every request (system prompt + lead/investor fields + activity feed + transcripts) are sent with a `cache_control` breakpoint so Anthropic caches them. Only the new user message and the chat-history delta cost full price each turn.
- **Max tokens:** 1500 (responses are concise by design; cap protects against runaway answers).

## Schema

### New table: `indica_messages`

```sql
CREATE TABLE indica_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  entity_type NOT NULL,         -- 'lead' | 'investor'
  entity_id    UUID NOT NULL,
  author_id    UUID REFERENCES users(id),    -- NULL for assistant
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX indica_messages_entity_idx ON indica_messages(entity_type, entity_id, created_at);
```

RLS: authenticated SELECT + INSERT (matches the activity-feed pattern). No UPDATE / DELETE policies — messages are immutable and never auto-deleted.

### Adjustment to `call_transcripts`

Add `attachment_id` so backfilled transcripts (which have no associated summary update) can link directly to their source audio.

```sql
ALTER TABLE call_transcripts
  ADD COLUMN attachment_id UUID REFERENCES attachments(id) ON DELETE CASCADE,
  ALTER COLUMN update_id DROP NOT NULL;

-- Replace the old UNIQUE on update_id with UNIQUE on attachment_id.
ALTER TABLE call_transcripts DROP CONSTRAINT call_transcripts_update_id_key;
ALTER TABLE call_transcripts ADD CONSTRAINT call_transcripts_attachment_id_key UNIQUE (attachment_id);

CREATE INDEX call_transcripts_attachment_id_idx ON call_transcripts(attachment_id);
```

Going forward:
- Summarize route writes `attachment_id` AND `update_id` (both populated).
- Backfill route writes `attachment_id` only (`update_id = NULL`).

## API routes

### `GET /api/indica/status?entity_type=&entity_id=`

Returns `{ needsBackfill: boolean, missingCount: number }`. Called by the panel on open.

Implementation: count audio attachments for this entity whose `attachment_id` isn't present in `call_transcripts`.

### `POST /api/indica/backfill-transcripts`

Body: `{ entity_type, entity_id }`. Walks missing audio attachments, runs Whisper, writes a `call_transcripts` row per success. Skips and logs failures. Returns `{ transcribed: number, failed: number }`.

Sequential, not parallel — keeps OpenAI API load bounded and lets us report progress (future enhancement: SSE for live progress; v1 just blocks until done).

### `POST /api/indica/chat`

Body: `{ entity_type, entity_id, user_message }`.

Flow:
1. Load entity record (lead/investor + phones, emails, properties).
2. Load all `updates` for entity, ordered by created_at.
3. Load all `attachments` linked to those updates.
4. Load all `call_transcripts` for those attachments.
5. Load full Indica chat history for entity.
6. Build Anthropic request with `cache_control` breakpoint after the static context.
7. Call `claude-sonnet-4-6`.
8. In a transaction: insert user message + insert assistant reply.
9. Return assistant message.

System prompt encodes the personality + scope rules described above and includes the asker's name (Randy or Aldo) for the address-by-name behavior.

## Files to create / modify

**Create:**
- `supabase/migrations/056_indica_messages.sql` — `indica_messages` table + `call_transcripts.attachment_id` adjustment.
- `src/lib/indica/system-prompt.ts` — the system prompt template.
- `src/lib/indica/context.ts` — builds the entity-context object passed to Claude (record + activity + transcripts + history).
- `src/app/api/indica/status/route.ts`
- `src/app/api/indica/backfill-transcripts/route.ts`
- `src/app/api/indica/chat/route.ts`
- `src/components/indica/FloatingIndicaButton.tsx` — the plum circle.
- `src/components/indica/IndicaChatPanel.tsx` — the popup with backfill flow + chat.
- `src/__tests__/lib/indica/system-prompt.test.ts` — verifies key directives are present.
- `src/__tests__/lib/indica/context.test.ts` — verifies context builder shape.

**Modify:**
- `src/app/api/summarize/route.ts` — also write `attachment_id` when inserting the `call_transcripts` row.
- `src/app/app/acquisitions/lead-record/[id]/client.tsx` — mount `FloatingIndicaButton`.
- `src/app/app/dispositions/investor-record/[id]/client.tsx` — mount `FloatingIndicaButton`.
- `src/components/VersionLabel.tsx` — bump to v4.21.0.

## Testing

**Unit (Vitest):**
- `system-prompt.test.ts`: rendered prompt includes literal phrases for honesty, conciseness, citation, scope boundary, and the asker's name slot.
- `context.test.ts`: given a synthetic entity payload, builds the expected context shape with all sections present (record, activity, attachments, transcripts, chat).

**Manual verification (post-deploy):**
1. Open a lead with no prior Indica messages and several audio attachments that haven't been transcribed yet → see popup → click Continue → progress bar with disclaimer → chat enabled.
2. Ask a question whose answer is in a transcript → Indica answers concisely with a citation referencing the call date.
3. Ask a question whose answer is in an activity-feed note → Indica cites Aldo's note.
4. Ask a question whose answer isn't in the data → Indica says it doesn't have anything on that.
5. Open the same lead in another browser as Aldo (or simulate) → both users' messages appear, attributed by name, gold for Randy and gray for Aldo.
6. Add an activity-feed note → ask a follow-up question → Indica's next reply reflects the new note (live refresh).
7. Open Indica on an investor record → confirm the same behavior with investor-specific fields.

## Rollout

Single deploy:
1. Apply migration `056` to production Supabase.
2. Ship code; Vercel deploys.
3. Bump to v4.21.0.

No feature flag. Indica is immediately available on every lead/investor record.

## Future (Phase 2.1+)

- Streaming responses for snappier UX.
- Action-taking ("Indica, add a follow-up note that…").
- Cross-record analytics ("Indica, which of my Sammamish leads have the highest motivation signal?").
- Photo/PDF vision (let Indica see attachment contents).
- Mobile-optimized chat layout.
