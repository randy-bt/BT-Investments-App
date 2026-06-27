# JV Deal Inbox + Email Intake — Design

**Status:** Approved, proceed to implementation plan
**Date:** 2026-06-25

## Goal

Stop inbound JV / wholesale deals from slipping through the cracks. Today they arrive scattered across email (most), a couple of wholesaler "active deals" web pages, Investor Lift, and some texts — and the ones Randy doesn't get to right away get lost. This builds a single **JV Deal Inbox**: one place where every inbound deal lands in a consistent shape (address, asking price, Redfin price, source), so Randy can skim, flag the good ones, and act fast.

This is **Slice 1 of a multi-slice system**: the shared inbox + the **email** feeder. Other feeders (website scrapers, Investor Lift, SMS) are separate later slices that drop into the same inbox.

## Out of scope (this slice)

- **Website scrapers** (the 2 wholesaler "active deals" pages) — Slice 2.
- **Investor Lift** — its own slice (complex; separate spec).
- **SMS intake** — later slice.
- **Assigning deals to teammates** — deferred; v1 triage is Interested / Didn't Sell / Clear only.
- Any change to acquisitions, dispositions, marketing, or `deal_sends`. The JV inbox is fully separate.

## Source of deals (this slice)

Two ways in this slice:
1. **Email** — Randy's existing dedicated **JV Gmail** address (already collecting these emails). The system reads it over IMAP — the same `imapflow` + Gmail pattern the daily digest already uses. Setup dependencies (Randy, at build time): IMAP enabled on that Gmail and an **app password** generated; both stored in app settings.
2. **Manual add** — a button to enter a deal by hand (address, source, optional asking price, note), for anything that arrives through a channel not yet automated (text, call, etc.). See the Manual add section under the JVs page.

## Data model

### `jv_deals` — one row per deal
- `id`, `created_at`, `updated_at`
- `source_channel` — enum `email | manual | website | investorlift | sms` (only `email` and `manual` this slice)
- `source_name` — display of who it came from (email sender name / fallback sender address; for manual, the free-text source Randy types)
- `source_url` — link to the source. For email: a Gmail deep link built from the RFC822 Message-ID (`https://mail.google.com/mail/u/0/#search/rfc822msgid:<id>`). For future channels: the listing/page URL. For **manual** adds: null (the card opens the note instead).
- `source_ref` — the RFC822 Message-ID (email; used for idempotency so a message is never processed twice). Null for manual.
- `address` (nullable), `address_normalized` (for dedupe)
- `asking_price` (text — wholesalers phrase these inconsistently)
- `redfin_price` (numeric, nullable), `redfin_url` (nullable)
- `note` (text, nullable) — free-text note; used by manual adds and shown when the card is clicked, in place of a source link
- `raw_excerpt` — stored snippet/body of the original email (audit + fallback; primary review is the source link)
- `status` — enum `new | interested | didnt_sell | cleared` (`cleared` = archived)
- `needs_review` (bool) — set when the parse was low-confidence
- `extra` (jsonb, nullable) — any other parsed fields (beds/baths/notes) without schema churn

### `jv_deal_events` — append-only activity log
- `id`, `jv_deal_id`, `event_type` (`received | interested | didnt_sell | cleared | restored`), `actor_id` (nullable; null = system/email intake), `created_at`, `metadata` (jsonb)
- This log is the source of truth for the archive badges (whether a deal was ever Interested and/or Didn't Sell before being cleared).

### `app_settings` (reuse existing table)
- JV Gmail address + app password, last-seen IMAP marker (UID/UIDVALIDITY), intake-start cutoff timestamp, poll interval, and an enabled on/off flag.

## Email intake pipeline

Runs as a **scheduled job** (Vercel cron, ~every 10 min) hitting an authenticated route (e.g. `/api/jv/scan`, cron-secret protected).

1. **Connect** to the JV Gmail via IMAP; fetch only messages newer than the last-seen marker **and** after the intake-start cutoff (so historical inbox clutter never floods in).
2. **Classify + extract** per message with a cheap model: is this a deal? If yes, extract **0..N deals** (one blast email can list several properties), each with address / asking price / source / any extras.
   - **Noise** (not a deal) is skipped (optionally logged), no card created.
   - **Default to inclusion:** ambiguous-but-deal-like messages still create a card flagged `needs_review` rather than being dropped.
3. **Dedupe** each extracted deal by `address_normalized` **against active JV deals only** (`status != cleared`). A match is skipped (logged), not duplicated. (No cross-checking against leads/dispositions/etc.)
4. **Enrich** with Redfin price via the existing scraper (`src/lib/scraper.ts`), best-effort; left blank on failure.
5. **Insert** the `jv_deals` row + a `received` event. Advance the last-seen marker.

**Cost:** IMAP polling is free; AI runs only on genuinely new messages (cheap model, fractions of a cent each); Redfin is a free scrape. Cost scales with deal volume, not poll frequency.

**Calibration (build-time task):** analyze a sample of what's currently in the JV Gmail to tune the deal-vs-noise classification prompt before going live.

## JV page — `/app/jvs`

Nav: new **"JVs"** item immediately after **Dispositions**. Visible to **Randy and Aldo** only (admin-gated).

- **Active list:** narrow stacked **cards** styled like the Deals-Sent cards in investor records. Each card shows: **address** (with a copy button), **asking price**, **Redfin price**, **source**, **date received**.
- **Clicking a card opens its source** in a new tab (the original Gmail message for email; listing URL for future channels). For **manual** deals (no source link), clicking instead shows the note you wrote in a popover.
- **Three actions per card:**
  - **Interested** → card turns **green**, stays in the list (active).
  - **Didn't Sell** → card turns **orange**, stays in the list.
  - **Clear** → moves to the **archive** (removed from the active list).
- `needs_review` cards get a subtle marker so low-confidence parses are obvious.

### Manual add
A **Manual Add** button on the JVs page opens a small form, for deals that arrive through channels not yet wired up (a text, a phone call, etc.):
- **Address** (required), **Source** (free text, e.g. "Text from John"), **Asking price** (optional), **Note** (optional).
- On submit: Redfin price auto-fills from the address (best-effort); the deal enters the active list as a normal card (`source_channel = manual`); a `received` event is logged with the user as actor.
- Manual deals run through the same address dedupe; a duplicate of an active deal is flagged.
- Clicking a manual card shows its **note** (popover) rather than opening a source link.

### Archive (sub-view of the JVs page)
- Lists `cleared` deals, each with **badges** reflecting its history — **"was Interested"** and/or **"was Didn't Sell"** (derived from the event log) — so the tags tell the full story.
- **Restore** action returns a deal to the active list (writes a `restored` event) — for accidental clears.

## Settings

A **JV** section under `/app/settings`:
- Connection status + enable/disable toggle, poll interval.
- The **activity log** — a simple reverse-chronological list of `jv_deal_events` (received / interested / didn't sell / cleared / restored, with actor + time). Lightweight; for recordkeeping and troubleshooting.

## Server actions

`markInterested`, `markDidntSell`, `clearDeal`, `restoreDeal` — each updates `jv_deals.status` and appends the matching `jv_deal_events` row (with `actor_id` = current user). `addManualDeal` — validates the form, runs Redfin enrichment + address dedupe, inserts a `manual` deal, and appends a `received` event. All admin-gated.

## Error handling & edge cases

- **Parse failure / no address:** still create a card (`needs_review`), never silently drop.
- **Multiple deals per email:** each becomes its own card.
- **Duplicate message / re-run:** idempotent on `source_ref` (Message-ID) so cron re-runs never double-insert.
- **Duplicate address (active):** skipped + logged.
- **Redfin lookup fails:** card created with blank Redfin price.
- **Gmail/IMAP failure:** job logs and exits cleanly; next run resumes from the last-seen marker.

## Testing

- Pure-function unit tests for **address normalization** and **dedupe**.
- Unit tests for **status transitions** and the **archive-badge derivation** from the event log.
- A parser test fixture: a few representative deal emails + noise emails asserting deal/no-deal classification and field extraction.

## Setup dependencies (at build time)

- IMAP enabled on the JV Gmail + an app password (Randy provides; walked through).
- Vercel cron entry for `/api/jv/scan` + a cron secret.
- Intake-start cutoff chosen so old inbox clutter is ignored.

## Future slices (context, not built now)

2. **Website scrapers** — 2 wholesaler active-deals pages; dedupe into the same inbox (overlap with email expected).
3. **Investor Lift** — its own spec.
4. **SMS intake.**
5. **Assignment to teammates.**
