# AUDIT.md — Full Optimization Audit (July 7, 2026, v6.2.0)

> **RECONCILED 2026-09-09 against v9.25.0** (169 commits later). Every finding
> below now carries a STATUS line. Read the STATUS before acting on a finding:
> most of this audit has already shipped, and treating it as a live to-do list
> would send you re-implementing work that is done.
>
> Summary: 13 SHIPPED, 3 PARTIAL (P1-3, P2-3, P2-7), 1 OPEN but NOT to be
> implemented as written (P1-6, the spec would break public lead capture),
> 2 left as-is by Randy's decision (P2-1 sms/navbar, P2-6 admin gate), 1
> skipped (P2-2).
>
> Both P0 items flagged as high-risk in the 9/9 review, the Pacific date bug
> and the non-atomic dashboard moves, were ALREADY FIXED. No legal document
> dates are wrong today.

Four parallel specialized reviews (security, bugs/correctness, performance,
architecture/ops) over the whole codebase, with top findings hand-verified
against source. **No code was changed.** Each item includes a spec detailed
enough for a smaller model to implement without further research.

**Overall verdict:** the app is in good shape for what it is — auth is
consistently enforced across all 135 server actions, RLS is enabled on every
table, no secrets in the repo, no injection/XSS surfaces, storage buckets
correctly private, and the hot query paths are indexed and paginated. The
real issues cluster in four areas: **timezone-correct dates, non-atomic
dashboard writes, slow-burn row caps, and operational blindness** (silent
cron failures, undocumented env).

Legend: P0 = fix this week · P1 = fix this month · P2 = worthwhile · P3 = nice-to-have

---

## P0 — Critical

### P0-1 · Server dates use UTC: every evening, "today" becomes tomorrow

**STATUS (v9.25.0): SHIPPED.** `src/lib/pacific-date.ts` exists and is used by `follow-up.ts`, `compute.ts` (the `today`/`today_plus_days`/`today_minus_days` cases, with a comment noting these print on legal documents) and `review.ts`. `src/__tests__/pacific-date.test.ts` exists. Legal-document dates are correct.
**Type:** Bug · **Verified:** yes, in source

Vercel runs in UTC. After 5:00 PM Pacific (4 PM in winter), `new Date()`
methods and `.toISOString()` roll to the next calendar day. Three user-facing
consequences, all in Randy's normal evening working hours:

1. **Follow-up dates off by one.** `src/actions/follow-up.ts:16-18`
   `todayISO()` returns the UTC date; `computeOffsetDate('1week', …)` then
   lands a day late, wrong `next_follow_up_date` saved to the lead.
2. **Activity-log date prefix wrong.** `src/actions/follow-up.ts:21-23`
   `datePrefix()` uses `now.getMonth()+1` / `now.getDate()` (UTC) → an
   evening note is stamped "7.8" on July 7.
3. **PSA contract dates wrong.** `src/lib/agreements/compute.ts:132-136` —
   `fn: 'today'` / `today_plus_days` / `today_minus_days` print tomorrow's
   date on any agreement generated in the evening. This appears in legal
   documents (effective date, EMD date, closing math).
4. **False "date is in the past" review warnings.** `src/lib/agreements/review.ts:65-66`
   compares against UTC midnight.

**Fix spec:**
- Create `src/lib/pacific-date.ts`:
  ```ts
  const TZ = 'America/Los_Angeles'
  /** 'YYYY-MM-DD' for the current Pacific calendar day. */
  export function todayPacificISO(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  }
  /** Date whose local getters reflect Pacific wall-clock time. */
  export function nowPacific(): Date {
    const parts = new Date().toLocaleString('en-CA', { timeZone: TZ, hour12: false })
    return new Date(parts.replace(', ', 'T'))
  }
  ```
- Replace usages: `follow-up.ts` `todayISO()` body → `return todayPacificISO()`;
  `datePrefix()` → build from `nowPacific()`. `compute.ts` cases 'today',
  'today_plus_days', 'today_minus_days' → `nowPacific()` instead of `new Date()`.
  `review.ts:65` → `const today = nowPacific(); today.setHours(0,0,0,0)`.
- Tests (`src/__tests__/pacific-date.test.ts`): `todayPacificISO()` matches
  `/^\d{4}-\d{2}-\d{2}$/`; `nowPacific()` differs from `new Date()` by the
  current UTC offset (7 or 8 h) within a minute's tolerance. Existing
  agreements compute tests must still pass (they use explicit date inputs).
- Note: `addDaysISO`/`addMonthsISO` in `src/lib/follow-up/date.ts` are pure
  UTC arithmetic on ISO strings and are CORRECT — do not touch them; only
  the "what is today" sources change.

### P0-2 · Non-atomic dashboard moves can silently delete a lead's line

**STATUS (v9.25.0): SHIPPED.** `follow-up.ts` writes the destination first ("Write the DESTINATION first" comment at :116) and returns the spec's exact "Moved to X but could not remove from Y" errors at :141 and :281.
**Type:** Bug (data loss) · **Verified:** by agent trace; same class in 3 places

`src/actions/follow-up.ts`:
- `triggerFollowUp` (~lines 221–252): removes the lead's line from ACQ/AACQ
  (write 1 commits), then reads+writes `follow_ups` (write 2). If write 2
  fails (transient Supabase error, timeout), the line is already gone from
  the source dashboard and never arrives at follow-ups. **The lead vanishes
  from the whiteboard system entirely**, with only a generic error shown.
- `sendPlusMoveToAacq` (~lines 122–141): same shape — ACQ removal commits,
  then AACQ append can fail.
- `moveBlockBetweenDashboards` in `src/actions/dashboard-notes.ts`: reversed
  variant — can duplicate the block (recoverable, lower severity).

**Fix spec (order-of-writes, no transactions needed):**
1. Read BOTH notes first.
2. Compute both new contents in memory.
3. Write the DESTINATION first (append). If it fails → return error, source
   untouched (worst case after a partial retry: line appears in two places,
   visible and manually fixable — never invisible).
4. Then write the source removal. If THIS fails → return
   `{ success: false, error: 'Moved to <dest> but could not remove from <src> — remove it manually' }`
   so the user knows exactly what state they're in.
- Apply the same pattern to all three functions. Add tests with a mocked
  Supabase client covering: dest-write failure (source unchanged) and
  source-write failure (explicit error message).

### P0-3 · Billing sync blocks the Settings page for 2–6 s

**STATUS (v9.25.0): SHIPPED.** `usage-stats.ts` wraps the billing sync in `after()` and the news counts are merged into the single `Promise.all` at :140.
**Type:** Performance · **Verified:** yes (I wrote it — the audit is right)

`src/actions/usage-stats.ts:117-120`: `await syncProviderBilling()` runs
before anything else. When the 6-hour freshness gate opens, the page load
waits on paginated Anthropic + OpenAI API calls plus an upsert before the
usage RPCs even start.

**Fix spec:** don't await the sync; kick it off and read the cached table:
```ts
void syncProviderBilling().catch((e) => console.error('[usage-stats] billing sync failed:', e))
billing = await getProviderBilling()   // reads local table — fast
```
Displayed numbers are then at most one page-load staler than today's
behavior (same 6 h guarantee). One caveat for the implementer: on Vercel,
fire-and-forget work can be killed when the response finishes — wrap with
`import { after } from 'next/server'` (Next 15+/16: `after(() => syncProviderBilling())`)
so the sync runs after the response is sent. While in the file, also merge
the three news-count queries into the main `Promise.all` (they're
independent; saves a round-trip — see `usage-stats.ts:206-210`).

### P0-4 · CRON_SECRET handling differs between the two cron routes

**STATUS (v9.25.0): SHIPPED**, with one difference from the spec: the helper landed as `isCronAuthorized` in `src/lib/cron-health.ts`, not `src/lib/cron-auth.ts`. It accepts both the raw and stripped forms as specified, and all THREE cron routes use it (jv/scan, news/refresh, follow-ups/sweep).
**Type:** Ops fragility · **Verified:** yes, in source

- `src/app/api/jv/scan/route.ts:32` strips the known Vercel trailing-`\n`
  quirk from `CRON_SECRET`; `src/app/api/news/refresh/route.ts:18` uses it
  raw. Vercel builds the cron `Authorization` header from the same env
  value, so **one of these two comparisons is wrong** depending on whether
  the stored value carries the `\n`: if it does, jv/scan's stripped compare
  fails (silently — the intake is dormant so nobody would notice); if it
  doesn't, both currently pass and this is latent.
- News refresh demonstrably works (articles update daily), which suggests
  the raw compare currently matches — meaning **jv/scan's auth may be the
  broken one** the day intake goes live.

**Fix spec:** one shared helper, used by both routes:
```ts
// src/lib/cron-auth.ts
export function isCronAuthorized(authHeader: string | null): boolean {
  const raw = process.env.CRON_SECRET || ''
  const stripped = raw.replace(/\\n$/, '').trim()
  if (!raw) return false
  // Accept either form so a re-saved env var can never break auth again.
  return authHeader === `Bearer ${raw}` || authHeader === `Bearer ${stripped}`
}
```
Replace both routes' inline checks. Verification step for the implementer:
after deploy, `curl -X POST https://<prod>/api/jv/scan -H "Authorization: Bearer <secret>"`
must return 200 (it will no-op while intake is disabled), and the next
day's news cron must still produce fresh articles.

---

## P1 — High value, fix this month

### P1-1 · Silent cron failures: nobody is told when automation breaks

**STATUS (v9.25.0): SHIPPED.** `src/lib/cron-health.ts` provides `reportCronFailure` / `clearCronError` / `LAST_CRON_ERROR_KEY`, and its header records the original rationale (failures vanishing into 24h Vercel log retention).
**Type:** Observability

There is no error tracking anywhere (console.error only; Vercel logs expire
in ~24 h on Hobby). A failing news refresh = stale news Randy notices days
later. A failing JV scan (once live) = deals silently piling up in email.
The June 26–July 2 all-deploys-broken week is the proven cost of this class.

**Fix spec (two cheap layers, both, ~25 lines total):**
1. **Email on failure** — in the catch blocks of `/api/news/refresh` and
   `/api/jv/scan`, call the existing `sendDirectEmail` (`src/lib/email.ts`)
   with `to: 'randy@btinvestments.co'`, subject
   `[BT App] Cron failed: <route>`, body = error message + timestamp.
   Guard with its own try/catch so alerting can't crash the route.
2. **Health badge** — on any cron failure, upsert
   `app_settings` key `last_cron_error` = JSON `{route, message, at}`; on
   success, clear it. In `src/app/app/settings/page.tsx`, if the key exists,
   render a red banner at the top ("News refresh failed <date>: <msg>").
   Dark-mode variants required.

### P1-2 · Four un-limited queries will silently truncate at 1,000 rows

**STATUS (v9.25.0): SHIPPED.** All three live queries carry `.limit(1000)`, and `listLeadsForAgreement` also carries the `.eq('status', 'active')` scope fix. `getInvestorDirectory` was deleted per P2-1 rather than fixed, as the audit intended.
**Type:** Bug (slow burn) — same root cause as the usage-monitor 92% bug

| Query | File | Breaks when |
|---|---|---|
| `listLeadsForAgreement` | `src/actions/agreements.ts:547` (also fetches closed/archived leads — wrong scope today) | total leads > 1000 |
| `listGeneratedAgreements` | `src/actions/agreements.ts:387` | agreements per active/archived bucket > 1000 |
| `getInvestorDirectory` | `src/actions/investors.ts:336` | dead code — see P2-1; delete instead of fixing |
| `listJvDeals` | `src/actions/jv-deals.ts:22` | total JV deals > 1000 |

**Fix spec:** `listLeadsForAgreement` → add `.eq('status', 'active')` (an
agreement is only ever generated for an active lead) — this both fixes the
scope and defers the cap for years; still add `.limit(1000)`.
`listGeneratedAgreements` and `listJvDeals` → add explicit `.limit(1000)`
now and a `// PostgREST caps at 1000 — add pagination before this table
approaches that` comment. Grep check for the implementer: every
`.select(` in `src/actions/` must have a `.limit(`, `.range(`,
`.single()`, `.maybeSingle()`, or `head: true` in its chain — add limits to
any newly-found stragglers.

### P1-3 · Env vars: 17 undocumented, none validated at boot

**STATUS (v9.25.0): PARTIAL.** `.env.example` exists. `src/lib/env.ts` does NOT.
**Type:** Ops / bus-factor

`.env.example` lists 11 vars; the code reads 28+. Missing from the example:
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `CRON_SECRET`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID`, `NEWS_ANTHROPIC_API_KEY`, `NEWS_API_KEY`,
`FRED_API_KEY`, `DIGEST_GMAIL_USER`, `DIGEST_GMAIL_APP_PASSWORD`,
`QUO_API_KEY`, `QUO_FROM_NUMBER`, `OPENAI_ADMIN_KEY`, `ANTHROPIC_ADMIN_KEY`,
`JV_IMAP_HOST`, `JV_IMAP_USER`, `JV_IMAP_PASSWORD` (+ auto-generated
`VERCEL_OIDC_TOKEN`). A fresh clone or AI session has no way to know these
exist; missing ones fail mid-request, not at startup.

**Fix spec:**
1. Rewrite `.env.example` with every var, one comment line each
   (what it's for, which feature dies without it, prod-only vs dev). Values
   as empty placeholders — never real keys.
2. Create `src/lib/env.ts` exporting `getEnv(name, {required?: boolean})`
   that strips the trailing-`\n` quirk once, centrally. Migrate call sites
   opportunistically (don't do a big-bang rewrite; the strip-quirk copies in
   quo.ts / billing.ts / jv/imap.ts become imports of this).
3. Add a lightweight `scripts/check-env.mjs` that lists which documented
   vars are absent locally (informational, not blocking).

### P1-4 · Content-marker strings are a hidden schema scattered across files

**STATUS (v9.25.0): SHIPPED.** `src/lib/content-markers.ts` exists and is imported by consumers such as `/api/summarize`.
**Type:** Architecture · high AI-session-regression risk

Feed rendering dispatches on literal prefixes: `— AI Summary —`,
`— Deal Snapshot —`, `— AI Review —`, `✉️ Email sent via BT App`,
`💬 SMS sent via Quo`, `[N file(s) attached]`. Writers and readers live in
different files; worse, `ActivityFeed.tsx:14` imports `AI_SUMMARY_PREFIX`
**from an API route** (`@/app/api/summarize/route`) — a client→server-route
import that breaks the build the day that route gains a server-only import.

**Fix spec:** create `src/lib/content-markers.ts` exporting all marker
constants with a header comment: "These are a de-facto schema for
historical feed rows. NEVER change existing values; add new ones only."
Update all writers (`api/summarize/route.ts`, `up-next.ts`,
`messaging.ts`) and readers (`ActivityFeed.tsx`, `up-next/client.tsx`,
lead-record client) to import from it. Zero behavior change; verify with
`npx vitest run` + grep that no literal `'— Deal Snapshot —'` strings
remain outside the new module and tests.

### P1-5 · Public form rate limiter doesn't work on serverless

**STATUS (v9.25.0): SHIPPED.** Migration `072_form_rate_limit_index.sql` is present, so the Postgres-backed limiter and its index landed. No new migration needed.
**Type:** Security (abuse/cost)

`src/lib/rate-limit.ts` keeps counts in process memory;
each Vercel instance has its own empty Map, so `/api/forms/submit`'s
5/min limit only holds within one warm container. Burst traffic → unlimited
DB inserts + Resend notification emails (quota exhaustion, inbox flood).

**Fix spec (no new paid service):** enforce the limit in Postgres, which is
already shared state. Add migration `072_form_rate_limit.sql`: in the
submit route, before inserting, run one query counting
`public_form_submissions` where `ip_address = $ip AND submitted_at > now() - interval '1 minute'`;
if ≥ 5 → return 429. Also add a daily cap (e.g. 100/day per IP) with a
second count against `interval '1 day'`. Keep the in-memory limiter as a
cheap first filter. Requires an index:
`CREATE INDEX idx_form_submissions_ip_time ON public_form_submissions (ip_address, submitted_at DESC);`
(Upstash Redis is the standard answer but adds an external dependency +
env for marginal benefit at this scale.)

### P1-6 · Google Places proxy routes have no in-handler auth

**STATUS (v9.25.0): OPEN, and DO NOT implement as written.** The spec assumes these routes are internal. They are not: `/api/places/autocomplete` and `/api/places/details` are called from PUBLIC, unauthenticated pages, `src/app/hello/HelloSellForm.tsx` (the public seller form) and `src/components/marketing/MarketingAddressInput.tsx`. Adding `requireAuth` would break live lead capture on the marketing site. Any hardening here has to distinguish public callers from app callers (referer/origin checks, or a separate public-scoped route with its own rate limit), which is a different piece of work than the audit describes.
**Type:** Security (defense-in-depth)

`src/app/api/places/autocomplete/route.ts` and `.../details/route.ts` contain
zero auth code (verified: no `getAuthUser`/`auth.getUser` references). Today
`src/proxy.ts` middleware fronts them, but every other route also checks
in-handler; these two are one middleware-matcher edit away from being open
proxies to your (currently billing-disabled, someday re-enabled) Google key.

**Fix spec:** copy the session-check block from
`src/app/api/listing-pages/generate/route.ts` (Supabase server client from
request cookies → `auth.getUser()` → `401` JSON if absent) into the top of
both handlers. ~10 lines each, no behavior change for logged-in users.

---

## P2 — Worthwhile improvements

### P2-1 · Delete dead code (~600 lines)

**STATUS (v9.25.0): SHIPPED for the dead code.** `src/lib/lead-ai-review.ts` is gone, and `postLeadMarketingOneLiner`, `inviteUser` and `getInvestorDirectory` no longer exist. The sms-marketing pages and the navbar entry are LEFT AS IS per Randy (9/9); he uses Bird for SMS.
All verified zero-caller by the architecture pass:
- `src/actions/lead-ai-review.ts` — entire file (215 lines). Superseded by
  Deal Snapshot. **Keep** the `— AI Review —` render branch in
  ActivityFeed (historical rows still use it); move the string to
  content-markers (P1-4).
- `postLeadMarketingOneLiner` in `src/actions/up-next.ts` (~lines 675–825)
  — quick action was removed from the UI; keep its `FEATURE_LABELS` entry
  for historical usage rows.
- `inviteUser` in `src/actions/users.ts:31` — explicit stub.
- `getInvestorDirectory` in `src/actions/investors.ts:330` — also carries
  the P1-2 row-cap bug; deleting resolves both.
- Decide on `src/app/app/sms-marketing/*` (6 placeholder pages linked from
  the navbar, all dead links `#`). Recommend removing the navbar entry and
  leaving the routes (cheap) or deleting outright — Randy's call, since SMS
  marketing may still be on the roadmap.
Verification: `npx tsc --noEmit && npx vitest run && npm run build`.

### P2-2 · Extract the shared search hook (kills the three-component trap)

**STATUS: SKIPPED by decision (Randy, 9/9).** No visible benefit, real parity risk in the three search components.
`HomeSearch.tsx` (252 l), `SearchCommand.tsx` (253 l), `InlineSearch.tsx`
(151 l) duplicate debounce, fetch, keyboard nav, click-outside, and empty
state; only the shells differ. Extract `src/hooks/useSearch.ts` returning
`{query, setQuery, results, isPending, highlightIndex, handleKeyDown,
containerRef}` plus a shared `SearchResultRows` component for the
Leads/Investors/Properties sections. Each component keeps only its visual
wrapper. This deletes the standing "touch all three" rule. Behavior parity
checklist for the implementer: 300 ms debounce, ArrowUp/Down wrap, Enter
opens, Escape closes, mode filtering in InlineSearch, Cmd+K open/close in
SearchCommand.

### P2-3 · One `stripEmojis`, not five

**STATUS (v9.25.0): PARTIAL.** `src/lib/strip-emojis.ts` exists with 7 importers, so 4 of the 5 duplicates are gone. ONE local copy remains: `src/components/ActivityFeed.tsx:56`.
Identical implementations in `follow-up.ts:38`, `up-next.ts:31`,
`ActivityFeed.tsx:44`, `DashboardNotes.tsx`, `count-matches.ts:3`. Move to
`src/lib/strip-emojis.ts`; import everywhere. (Distinct from
`stripTrailingEmojis` in `lib/follow-up/transform.ts` — leave that one
alone.) Zero behavior change; tests must pass.

### P2-4 · Centralize the Randy/Aldo permission constants

**STATUS (v9.25.0): SHIPPED.** `OWNER_EMAIL` is exported from `src/lib/team.ts` and imported at the call sites.
`randy@btinvestments.co` is hardcoded in 9 files as a permission gate
(CC Summarize, Send+, from-address matrix, callback allow-list).
`src/lib/auth.ts` already exports `PARTNER_EMAILS`; add
`export const OWNER_EMAIL = 'randy@btinvestments.co'` and import it at all 9
sites (5 for Aldo's). Makes "who can do what" greppable in one place.

### P2-5 · Sequential query cleanups (perf pass, ~30 min total)

**STATUS (v9.25.0): SHIPPED, all three.** `hasPhotoAttachments` sits inside the lead-record `Promise.all`; `applyDashboardMutation` uses a batched `.in('module', …)`; `QuoSmsDialog` handles `document.hidden` / `visibilitychange`.
- `lead-record/[id]/page.tsx:35` — move `hasPhotoAttachments` into the
  existing `Promise.all` (saves a round-trip on the most-visited page).
- `applyDashboardMutation` in `up-next.ts:99-124` — replace 3 sequential
  SELECTs with one `.in('module', …)` SELECT + parallel UPDATEs (6 round
  trips → 2) — coordinate with P0-2's ordering rules where they overlap.
- `QuoSmsDialog.tsx:71` — skip the 20 s poll when `document.hidden`; catch
  up on `visibilitychange`.

### P2-6 · Small security hardening

**STATUS (v9.25.0): PARTIAL.** The `/api/news/tts` cap SHIPPED (`MAX_TTS_CHARS = 5000`). The admin gate on `/api/news/refresh` is LEFT AS IS per Randy (9/9): the route requires a valid session or the cron secret, it simply is not admin-only.
- `/api/news/tts`: cap `text.length` at 5,000 chars → 400 (ElevenLabs bills
  per character).
- `/api/news/refresh` session path: any member can trigger a full paid
  refresh; keep for Aldo but wrap in an admin check to match the UI, which
  only shows the button in settings.

### P2-7 · High-value missing tests (in priority order)

**STATUS (v9.25.0): 4 of 5 SHIPPED.** Present: `actions/follow-up`, `actions/messaging`, `pacific-date`, `actions/dashboard-notes`. Missing: `api/news-refresh-auth`.
1. `src/__tests__/actions/follow-up.test.ts` — mocked Supabase: correct
   chronological insert, AACQ-source variant, lead-not-found no-op, and the
   P0-2 failure-ordering guarantees.
2. `src/__tests__/actions/messaging.test.ts` — `allowedFromAddresses`
   matrix (randy→both, aldo→own only, member→own only), feed note format.
3. `src/__tests__/pacific-date.test.ts` — per P0-1.
4. `src/__tests__/actions/dashboard-notes.test.ts` —
   `moveBlockBetweenDashboards`, `revertDashboardNote`.
5. `src/__tests__/api/news-refresh-auth.test.ts` — cron auth acceptance
   matrix per P0-4.

---

## P3 — Nice to have

- **File splits** (only when next editing them, not as standalone work):
  `marketing-page-creator/create/client.tsx` (~1530 l → extract field-editor
  and generation-wizard components), `up-next/client.tsx` (~1350 l → extract
  UpNextCard), `ActivityFeed.tsx` (~1240 l → extract FileAttachments +
  UpdateCard), `actions/up-next.ts` (~990 l → split brief/dashboard
  modules).
- **Migration bookkeeping:** confirm 069/070/071 (applied via MCP) are
  recorded in `supabase_migrations.schema_migrations` so a future
  `supabase db push` doesn't re-apply them.
- **Dependency watch:** `rss-parser` unmaintained-but-stable;
  `linkedom`+`readability` pairing is the first suspect if article
  extraction regresses; `googleapis` major-bumps frequently — don't upgrade
  casually.
- **Cron slots:** both Hobby slots are used; the jv/scan slot is dormant.
  If JV intake stays off long-term, that slot is reclaimable.
- **Usage-monitor precision:** log cache-write tokens in our metering
  (closes the known ~$0.89/30d drift vs Anthropic's count); OpenAI
  web-search per-call surcharge remains unverified — check the bill line
  items once BT has its own OpenAI project.

---

## Verified clean (so future audits don't re-plow this)

- **Auth:** all 135 exported server actions call `requireAuth`/`requireAdmin`
  before mutating; admin client never reachable without a session; OAuth
  callback enforces @btinvestments.co (plus DB CHECK constraint).
- **Secrets:** no keys in tracked files; `.gitignore` covers `.env*`.
- **RLS:** enabled on every table; `agreements` + `attachments` buckets
  private (signed URLs, 5 min/1 h TTL); `listing-page-photos` intentionally
  public with auth-gated writes.
- **XSS:** single `dangerouslySetInnerHTML` is a hardcoded theme snippet;
  public deal pages render user HTML in sandboxed iframes without
  `allow-scripts`.
- **Query hygiene:** leads/investors/updates lists paginate with `.range()`;
  usage stats aggregate in SQL RPCs; search sub-queries `.limit(10)`;
  indexes match every hot query pattern checked (updates, phones/emails,
  api_usage_logs, jv_deals, entity_views, lead_ai_briefs).
- **Currency/date math in agreements:** `parseCurrency`/`currencyToWords`
  round correctly; `addDaysISO`/`addMonthsISO` are pure-UTC and correct;
  `parseDateSmart` year-defaulting safe on Node 18+.
- **QuoSmsDialog:** interval cleanup and stale-response guard correct
  (only the hidden-tab optimization in P2-5 remains).
- **Dependencies:** no known-CVE packages; versions current (Next 16.1.7,
  React 19.2.3, Zod 4, Tiptap 3 consistent family).
