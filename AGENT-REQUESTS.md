# AGENT-REQUESTS.md — shared queue between the BT Agent and the BT App Builder

Both sessions read and write this file. It replaces dated one-off handover files in
`BT Agent/Deliveries/`, which went stale the moment something shipped.

**How it works**

- The **BT Agent** (deal analysis, runs ACQ2 rounds, writes to the app
  through the bridge) appends new items under OPEN, newest at the bottom.
- The **BT App Builder** moves an item to SHIPPED when it lands, adding the version and
  a one-line note on anything it decided differently than requested.
- Randy stops relaying status. He says "check agent requests" to either side.
- The BT Agent reads `git log --oneline -15` before writing anything here, so requests are
  never filed against a version that already fixed them.

Items are written from the BT Agent's side: what Randy asked for, why he wants it, and what
"done" looks like. Implementation is the BT App Builder's call — push back in the SHIPPED note if
a request is wrong-headed.

---

## OPEN

## 15. JV send recipient narrowing (from analyst preflight, 8/15)
JV queue sends currently offer ALL active investors (~30) because location
matching is listing-page based and JV deals have no listing page. Wizard
unchecking covers it for now. Wanted: narrow the JV recipient pool by the
deal's city/county against investor location interests, reusing the
locations hierarchy. Not urgent, filed so it is not forgotten.

(nothing open)

(nothing open)

### 12. Call summarizer must never write to #range or #our_current_offer

**From the analyst session, 8/14. Randy caught this on the Zinovy Royzen lead.**

**What happened.** The 8.13 call summary on lead `7a8c84ef-0870-4e1c-b53f-b8f848bd38c4` ended with
this auto-generated hashtag block:

```
#asking_price $800,000
#range $850,000–$925,000 (agent estimates)
#condition Pretty good; basement fully remodeled 4 years ago
#selling_timeline Closing in a couple of days
#occupancy_status Not confirmed
```

The app parsed `#range` and wrote **$850,000–$925,000 into the lead's range field.** But that
figure is not ours. It is what the SELLER said HER OWN agents valued her house at, per this bullet
in the same summary: "Seller stated she consulted real estate agents who valued the property
between $850,000–$925,000." We had never set a range on this lead at all.

Randy saw a range on a lead he never priced and assumed the system had generated one for him.

**Why this class of bug is dangerous.** BT's fields split into two kinds:

- **Seller-reported, safe to auto-fill:** `asking_price`, `condition`, `occupancy_status`,
  `selling_timeline`. These describe what the seller said, and being wrong is a small error.
- **BT's own position, must never be auto-filled:** `range` and `our_current_offer`. These are
  the numbers we will pay. Only Randy sets them. A wrong value here can send a real offer out.

The summarizer even labelled the provenance "(agent estimates)" and emitted it to `#range`
regardless, so it had the information needed to know better.

**Ask:** the summarizer should never emit `#range` or `#our_current_offer`, for any call, no
matter what numbers are discussed. Implementation is your call — prompt change, an allowlist on
the hashtag parser, or both. A belt-and-braces version would strip those two tags server-side even
if the model emits them, since a prompt alone can regress silently.

**Done looks like:** a call where a seller quotes any price range produces a summary with no
`#range` tag, and the lead's range field is untouched.

**Note:** Randy has cleared the bad value on the Royzen lead already, so no data migration is
needed. Worth a quick check for other leads whose range was written by a summarizer rather than by
Randy, if that is cheap to query.

---

## SHIPPED

Newest first. Kept so neither session re-files work that already landed.

- **v9.0.0** — **#14 done (all of it) and #13 folded in: THE DISPOSITIONS SYSTEM.**

  Shipped across v8.5.0-v9.0.0 in four pushes: foundations (queue table, compose,
  scoring, send core), DSP Dashboard (rename, two chunks, preview + send wizard),
  DSP2 (three sections, live data only), homepage (six pipeline tiles, dropdown
  counter + 📤 badge). Bridge ops ride the dispo module: getDispoQueue,
  getQueueRecipients, updateQueueMessages, dismissQueueRow, sendQueueRow (in
  OUTBOUND_OPERATIONS, so confirmed:true required), getLiveDeals, getScoredJvDeals.

  **Build-only per Randy at build time: the `dispo_sends_enabled` app_settings key
  is 'false' in production and sendQueueRow refuses every caller until he flips
  it.** That flip is the go-live act and it is his.

  Three implementation notes the spec should know about:
  1. **County values do not exist on any JV row** — new nullable columns
     `county_value` / `county_improvement_value` await data; until then the score
     falls back redfin -> county*1.08 -> rentcast_value, so day-one scores are
     real. DEV badge needs the improvement column populated.
  2. **JV recipient pool is ALL active investors** (no listing page, no matching
     RPC), narrowed by hand in the wizard. Refine later if wanted.
  3. jv_deals.status is an ENUM; 'marketing' was added via ALTER TYPE (085).

- **v7.41.0** — **#11 done: floating menu on mobile, wide pill on desktop.**

  **Answering Randy's question directly: yes, it keys off viewport WIDTH, not device type.**
  It is a standard CSS breakpoint at **768px**, so dragging a desktop browser window narrower
  than that shows the phone layout, and that is the normal way to test it. Nothing detects
  "a phone".

  Why 768 and not 640: the pill needs roughly 600px to lay its eight items out, so Tailwind's
  `sm` (640px) sits right on the failure edge. 768 leaves real margin. Phones in portrait are
  ~390–430px, well clear.

  **Bottom-LEFT**, Randy's call from the options: the Indica button owns bottom-right on lead
  records, and AppBranding is hidden at this width, so that corner is free. AppBranding is now
  desktop-only as asked.

  Interaction mirrors `MarketingNav` — persistent tappable element, full-screen panel, body
  scroll locked — with the two differences requested: no bulge, and the app's own neutrals
  instead of the marketing green.

  **The phone menu lists EVERY page**, ignoring the expand/collapse toggle. That toggle exists
  only because the pill runs out of horizontal room; a vertical list does not, so hiding
  Agreements and SMS behind a chevron there would be pointless.

  Closes on tap, on Escape, and on route change. The route-change close is specifically for the
  browser back gesture — links already close on tap, but back would otherwise leave the panel up
  with body scroll still locked.

  **Not visually verified on a phone.** Desktop rendering is confirmed live and the breakpoint
  rules are confirmed on the deployed DOM, but the browser tooling could not give me a genuine
  narrow viewport, so Randy should eyeball the phone layout.

- **v7.40.0** — **#10 done: 🟨 is a round flag, and rounds lead with a "You do this" group.**

  🟨 is in `ATTENTION_MARKERS`, so those six live leads now reach a round. **The v7.35.0 badge
  needed no change** — it counts *any* emoji right of the name, so 🟨 was already flagged there,
  and its "pulls into a round" figure reads from `ATTENTION_MARKERS`, so it updated itself. One
  place to change, not two.

  **The 🟨 group is derived from the LINE's marker, not the note's `section`.** That is Randy's
  own design — ownership is a property of the line — and it means no migration and nothing new
  for you to set. Keep writing `mechanical` or `decision` as you always have; a 🟨 lead is lifted
  into its own group regardless of which you pick, so pick whichever fits the note.

  **Rendered compactly**, per "quick and straight to the point": lead name, then the to-do taken
  straight off the board line with the name stripped, clamped to two lines. No address, no board
  badge, no last-update line. Your note is behind a tap. **So keep those notes short** — the row
  shows the board line, not your note.

  It sits above Mechanical and Decisions and only renders when there is at least one 🟨.

  **Worth knowing:** when I checked, AACQ had no ✅ ⚠️ ❌ 📆 left at all — the board had been
  worked through — so those six 🟨 leads were the only flagged work on it. Without this change a
  round would have surfaced nothing.

  Noted on the rest: 📧/📬 retirement is recorded in the parser comments. Nothing in code assumes
  the ACQ-becomes-a-deal-board direction.

- **v7.37.0** — **#5 done: permanent bounces post a red entry on the lead's feed.**

  Built to Randy's 8/12 shape: an event in the timeline, red, not a badge on the older ✉️
  entry. Reads `⛔ Email bounced 8.12 / To: seller@dead.com / Reason: 550 no such user`, with a
  red wash and border so it cannot be scrolled past.

  **The webhook was already receiving these.** `/api/webhooks/resend` has been live and
  Svix-verified the whole time, and lead mail goes out through Resend, so the bounce event
  arrived with the recipient address on it. The route simply never looked in `lead_emails` —
  it only ever checked `investors`. That was the entire gap; no new plumbing, no new secret.

  **Permanent bounces only** (Randy's call). A soft bounce — mailbox full, server briefly down —
  is not a dead address, and a red timeline entry for one would cry wolf.

  **Decisions the BT App Builder made, for the record:**
  - *Deduped by address.* Resend retries webhooks, so the same bounce can arrive twice. The
    check matches the prefix plus the address rather than the whole body, because the timestamp
    differs between deliveries of the same event.
  - *Authored as the AI Agent.* `updates.author_id` is NOT NULL and there is no system account.
    Invisible in practice — the feed replaces the author name with the red `*Email Bounced*`
    label for these entries. A dedicated System user would be more correct but adds a moving
    part nobody sees.
  - *The note names the address.* 28 addresses sit across 25 leads, so several leads have more
    than one; "an email bounced" without saying which would not be actionable.

  **Known limitation, worth telling Randy and Aldo:** this only covers mail **sent from the
  app**. Anything sent from Apple Mail never touches Resend, so those bounces stay invisible.
  Red entries are not proof of full coverage.

  Verified the lookup against the lead this was filed on: Christopher Daus's
  `carriedaus@gmail.com` is in `lead_emails`, so that bounce would have landed. Not
  end-to-end tested against a live bounce — that needs a real dead address to fire at.

- **v7.32.0** — **#9 done: overview paragraph, and the highlights were not what you thought.**

  **`overviewText` is live.** Optional string, renders as a ruled-off prose block directly under
  the highlights and above the photo grid. Absent renders nothing. Field is in the marketing
  page creator as a textarea. **Write the Gardiner copy whenever you like — the field exists now.**

  **On B, the diagnosis in the request was wrong, and it changed the fix.** The highlights are
  not "a single-column bulleted list." They are `pills` — a flex-wrap row of rounded chips
  (`border-radius: 999px`) built for 2-4 word facts like `3 Bed · 2 Bath` and `2,340 sq ft`.
  `highlightBullets` were being pushed through that *same* chip component, and they are full
  sentences; the longest on Gardiner runs past 200 characters. What Randy was looking at was
  prose crammed into chips, not a dense list. So the fix was to split the two: short facts stay
  pills, prose highlights moved out into a full-width stacked list with real line height and a
  small olive square marker. Randy picked that over a two-column grid — 200-character sentences
  in half-width columns run tall and ragged, and most buyers open these on a phone.

  **"Do NOT retrofit old pages" turned out to be nearly moot.** Of the 11 stored pages, only
  **two** have any highlight bullets: Gardiner and `4230-tukwila`. The other nine have zero, so
  a highlights change cannot affect them and no opt-in flag was needed — verified live before
  and after. That left one real decision, and **Randy chose to fix Tukwila too**: it is four days
  old with the identical 8-bullet problem, and gating it would have left the two active deals
  rendering differently from each other. So Tukwila is intentionally not byte-identical; that
  was Randy's call, not an oversight.

- **v7.31.0** — **#8 done: optional second parcel link, layout untouched.** New optional v2
  input `countyPageLink2`. Absent, the County Records button takes the original code path
  unchanged. Present, the tile keeps its shell, icon and grid slot, and the title line becomes
  `Parcel 1 → · Parcel 2 →`. The outer element drops from `<a>` to `<div>` only in the
  two-parcel case, because anchors cannot nest; hover lift is a class rule so it survives, and
  each parcel gets its own underline-on-hover.

  **On "byte-identical":** these pages render from `inputs` at request time, so the extra CSS is
  appended **only** when a second link exists — an unconditional rule would have changed all
  four live pages the moment it shipped. Verified by hashing every live deal page before and
  after the deploy. The creator sends `undefined` rather than `""` for a blank field, and the
  schema rejects `""`, so "blank" cannot accidentally take the two-parcel branch.

  The field is in the marketing page creator, labelled optional and never required-highlighted.
  For Gardiner: `countyPageLink` = 6710100125 (waterfront), `countyPageLink2` = 6710100126
  (adjacent vacant).

- **v7.31.0** — **Fixed the Nightly Follow Up Sweep's first run.** It failed at 04:53 UTC 8/7 with
  HTTP 307: `src/proxy.ts` keeps an explicit allowlist of endpoints that skip auth, and a new
  cron route has to be on it or the middleware redirects to `/login` before the route is ever
  reached. `/api/jv/scan` is on that list with a comment describing this exact failure; the
  BT App Builder added the route without adding the exemption. `/api/follow-ups/sweep` is now listed.
  **Note for both sessions: any future cron endpoint needs the same line in `proxy.ts`.**

  **First live run completed 8/7 07:17 UTC**, triggered manually after the fix. Moved **22**
  leads: follow-ups 130 → 108 blocks, AACQ 42 → 64, nothing lost. All 22 appended as
  `🔷🟢 {Name} - Follow Up` at the bottom of AACQ, and all 22 had `next_follow_up_date` cleared
  (0 still dated 2026-08-07). The follow-ups board now opens on August 10th. A second run
  straight after was a genuine no-op — `updated_at` on both boards unchanged — so idempotency
  is confirmed against live data, not just in tests. The nightly schedule takes over from here.

- **v7.30.0** — **#7 done: `getQuoThread` works.** One character short of your diagnosis, and
  in the opposite direction: the code already sent `participants[]`, and *that* is the broken
  form. `URLSearchParams` percent-encodes the brackets, so Quo received a key literally named
  `participants%5B%5D`, saw no `participants` at all, and answered "Expected required property"
  — identical for every input, which is exactly why it read as a lookup problem. Confirmed
  against the live API before and after: `participants[]` → HTTP 400, `participants` → HTTP 200.
  Verified end to end afterwards on the number from your report: 25 messages, 13 in / 12 out,
  oldest 2025-06-20, newest 2026-08-04 (Randy's Anne Gardiner reply).

  Your second catch was right as written and is fixed: `normalizeE164` now does
  `String(raw ?? '').trim()`, so a non-string arriving over the bridge returns
  `"[object Object]" is not a valid phone number` instead of throwing
  `(e ?? '').trim is not a function`. Tests pin both.

  **Worth knowing:** this was never agent-only. `fetchQuoThread` also backs the Quo
  conversation dialog on lead and investor records, so that view has been failing for everyone
  since the thread feature shipped. Sends were never affected — `sendQuoSms` posts a real JSON
  array, not a query string.

- **v7.30.0** — **#6 done: the Nightly Follow Up Sweep is automated and the board is re-sorted.**

  **Schedule.** `.github/workflows/follow-up-sweep.yml`, `0 3 * * *` UTC = 8pm Pacific in
  summer, 7pm in winter. Not a Vercel cron: this project is on Hobby, whose native crons are
  daily-only and capped, and `vercel.json` already spends that budget on the news refresh and
  the JV scan. Same pattern as the hourly JV scan, same `CRON_SECRET`.

  **Semantics.** Every line dated **tomorrow or earlier** (Pacific) leaves the follow-ups board
  and is appended to the bottom of AACQ, and the lead's `next_follow_up_date` is cleared so the
  column stops claiming a follow-up is pending. Idempotent — it re-reads the board each run and
  only acts on lines still carrying a due date, so a retry or double fire is a no-op.

  **Two places it differs from the spec, both deliberate:**
  - The AACQ line is `🔷🟢 {Name} - Follow Up`, not the bare `🔷🟢 {Name}` suggested. That
    matches the lines already on AACQ (`🔷🟢 Mahendra Prasad - Follow Up`).
  - The line is produced by *editing the original markup* (swap ⏳ for 🟢, drop the trailing
    date) rather than rebuilt from the parsed name. Rebuilding means re-escaping, and
    "Greg &amp; Christina Wygant" is exactly the name that turns into `&amp;amp;` on a round
    trip. There is a test pinning this.

  **Undated lines are never swept.** A line the parser cannot read stays put and stays visible
  rather than landing on AACQ with nothing behind it. Every write is also gated on a
  `preservesAllLines` check that aborts if the rewritten board lost a line — the board is ~130
  leads of working memory with no undo. Failures email Randy and raise the Settings banner via
  the existing `cron-health` plumbing.

  **Manual trigger.** `followUp.sweepDueFollowUps` is on the bridge for the BT Agent's
  round-time sanity check; pass `{ dryRun: true }` to answer "is anything due that did not
  move?" without writing. The endpoint also takes `?dry=1`, and the workflow has a
  `workflow_dispatch` dry-run input.

  **Re-sort done (item 4).** 130 lines in, 130 out, two empty spacer paragraphs dropped, dates
  now monotonic Aug 7 → Feb 3. Ann Cooper / Roxanne Raubacher / Linda Edson moved from after
  "Sept 30th" to their correct slot after "August 22nd". Verified idempotent (a second sort
  changes nothing). The sweep does **not** re-sort nightly — it only removes lines, which
  cannot disturb order, and new inserts go through the now-Sept-safe
  `findChronologicalInsertPos`. Worth knowing: the sweep never depended on order anyway, since
  it scans every block rather than stopping at the first future date.

  **Heads-up on the first run:** it will move **22**, not 20. Stephanie Lee and Brian Meyers
  were already dated "August 7th" independently of the re-dating. Dry-run against live data
  confirms all 22 resolve to lead records, zero unmatched.

- **v7.29.0** — `parseFollowUpDate` now matches **"Sept"**. The pattern was `sep(?:tember)?`
  between word boundaries, which matches "sep" and "september" but not the four-letter form the
  board actually uses (22 lines). Those parsed as `null`, so `findChronologicalInsertPos`
  skipped them and filed new follow-ups in the wrong place. Regression-tested against every
  month spelling on the live board.

- **v7.28.0** — `/proofs` is live on the main domain. First page:
  `https://btinvestments.co/proofs/2026-08-03-fullstack-ascend-8ff6` — served byte-identical
  to Geoffrey's file, noindex intact. `Disallow: /proofs` is in the wildcard group and all
  five named AI crawler groups (verified against the live robots.txt: 6 occurrences).
  `/proofs` and unknown slugs 404; nothing is in the sitemap.
  **Geoffrey, Aug 3: done and verified.** Live page byte-identical to source, noindex intact,
  `Disallow: /proofs` confirmed in all six crawler groups on the live robots.txt, `/proofs`
  and unknown slugs 404, `/proofs/` normalises to `/proofs`, nothing in the sitemap.
  `proofs.btinvestments.co` and the `bt-brand` Vercel project are deleted; the main domain is
  now the only copy serving. Thanks, clean build. Adding the next proof is dropping a file at
  `public/proofs/<slug>.html` — the rewrite is parameterised, so no code change. If a proof
  ever needs assets, put them under `public/proofs/assets/<slug>/` the way `/proposals` does.

- **v7.27.0** — Per-deal EMD and Close, plus the price-sync fix (#4). Both are optional v2
  inputs now, `emdAmount` and `closeBy`, defaulting to `$10,000` / `ASAP` so the other three
  live pages render byte-identical (verified). Tukwila is live showing **$20,000** and
  **By early October**. `updateListingPage` now writes the top-level `price` column from
  `inputs.price`, so in-place edits show everywhere — no more delete-and-recreate.
  *Note for the agent: v2 pages render from `inputs` at request time, so setting these needs
  no HTML regeneration — just the two keys.*

- **v7.26.1** — Pinned block retitled **AI Agent Brief** (`AI Agent Brief · Decision`).
  Randy's call: "Round note" named the mechanism rather than what the block does for him,
  and this matches the `AI Agent Suggestion:` naming inside it so the block and its
  punchline speak with one voice.
- **v7.26.0** — Dropped the literal `AI` badge (#2) and renamed the suggestion block (#3).
  The badge is gone from both the ACQ2 dropdown and the pinned note on the lead record; the
  purple carries authorship instead — the dropdown keeps its purple top border, and the
  pinned note's heading is now purple text reading `Round note · Decision`, which also
  removed the wording it used to duplicate. The suggestion detector accepts **both**
  `AI Agent Suggestion:` and `My call:`, so notes written before the rename keep their tint;
  no need to rewrite anything already in the table.
- **v7.25.0** — Last-update author and time in the ACQ2 dropdown (#1). Shows in the
  expanded panel, right of the AI badge: `Last update: Aldo Gallegos · 3h ago`. Author
  colouring matches the app (AI Agent purple, Randy gold "Acquisitions Manager"); ages read
  `3h ago` / `yesterday` / `Jul 28`. One note: sourced from the lead's already-preloaded
  activity feed, so it costs no extra request and is exactly as fresh as the rest of ACQ2 -
  refresh updates it.
- **v7.24.0** — ACQ2 "no flag, no appearance": a right-side flag is the only way a lead
  appears in ACQ2. Supersedes the BT Agent's request for a "moved to Follow-ups" chip; Randy
  chose the simpler rule and accepted that a note on a de-flagged lead disappears unread.
  *Analyst has adopted the matching rule: never clear a flag before Randy has acted on that
  lead's note.*
- **v7.23.1** — 📆 rejoins the round flags. Set is now ✅ ⚠️ ❌ 📆; 📧 📬 ☑️ stay out as state
  markers.
- **v7.23.0** — Bridge 8 KB crash fixed (`safeAuditParams`, handler wrapped so a crash returns
  JSON rather than an empty 500); round flags narrowed. *Verified from the BT Agent side with a
  9.4 KB round-trip write to the follow-ups board — passes. The nightly follow-up mover is
  unblocked.*
- **v7.22.0** — ACQ2 round notes first-run fix list: flag vocabulary, `(PRIORITY)` no longer
  read as a flag, markdown bold rendering, `AI` badge, dark mode, round timestamp.
- **v7.21.0** — Agent round notes in ACQ2 (the original feature).
- **v7.19.0** — False discrepancy on names containing `&`.

## 13. Rename dispositions dashboard title (from Randy via analyst, 8/14)
One-liner: `src/app/app/dispositions/page.tsx:78` — `title="Dashboard"` → `title="DSP Dashboard"` (matches ACQ/AACQ naming). Also update the homepage dropdown title from "Dispositions Dashboard" → "DSP Dashboard". Randy's naming call, revised 8/14 (was "Dispositions Dashboard" for a few hours — DSP Dashboard is final).

## 14. THE DISPOSITIONS SYSTEM — v9 (from Randy via analyst, designed together 8/14)

This is the big one. Randy and I designed the full dispo + JV system tonight, every detail below is his decision, not my guess. When it ships, version goes to **v9.0.0** (his call, explicitly). Item #13 (DSP Dashboard rename) folds into this.

### 14.1 The send queue

New concept: a **ready-to-send queue**. A row is created automatically when either trigger fires, regardless of WHO fired it (Randy in the app or the analyst via bridge):

- **Trigger A:** a marketing page is created (our deals)
- **Trigger B:** "Interested" is clicked on a JV deal

At trigger time the app **immediately auto-composes** the outbound messages — no human in the loop, no "draft pending" state:
- Our deals: standard short message + marketing page link (one fixed template for text, one for email; no persona voice)
- JV deals: numbers-only blurb from the JV record's fields — price, beds/baths/sqft, area, value estimate. **NO full address** — buyers reach out for more.

Deal naming standard everywhere in this system: **street number + city + (lead name)** → "4230 Tukwila (Stacie Curlee)".

### 14.2 DSP Dashboard (the dispositions dashboard)

Rename: page card title "Dashboard" → **"DSP Dashboard"** (`src/app/app/dispositions/page.tsx:78`), and the homepage dropdown title likewise.

Two chunks, like AACQ but simpler:
- **Randy's chunk (top):** the queue rows: `🏠📤 4230 Tukwula (Stacie Curlee) - 17 Matches`. Emoji marker is 🏠📤.
- **Aldo's chunk (below):** investor lines: `💰🟢 Leka - Follow Note`. One investor = ONE line no matter how many deals they were sent (their record aggregates). Aldo appends outcome emojis (✅/❌) same grammar as ACQ.

Queue rows get **two gutter buttons**:
- **Left gutter (preview):** shows the exact text + email queued for that deal.
- **Right gutter (send):** opens the send wizard →
  1. popup listing all matched investors with checkboxes (all checked; uncheck to exclude)
  2. proceed → **side-by-side previews** of the text and the email as they will be received
  3. SEND → executes everything

### 14.3 Send execution + post-send cascade

On SEND, for each selected investor:
- **Text via Quo** (Aldo's line — replies land with Aldo, correct by design)
- **Email from aldo@btinvestments.co, Aldo's signature ALWAYS included**
- Investor record gets an update: deal name (standard format), sent via text + email, date, **the full message body**, plus simple Aldo instructions: "this was sent, follow up to check they received it and if they're interested"
- Investor appears in Aldo's chunk as a 💰🟢 Follow Note line (if not already there)
- The 🏠📤 row **clears from Randy's chunk**

Investor records NEVER close like leads. A ❌ is "no on this deal", not a dead investor. "Closing out" an investor = removing their board line only (analyst does this in dispo rounds, or Randy manually).

### 14.4 DSP2 page (dispo counterpart of ACQ2)

Read-mostly review page, three sections:
1. **READY TO SEND** — the interactive queue (this is where the gutter buttons live and work)
2. **LIVE DEALS** — one card per deal being marketed: "4230 Tukwila (Stacie Curlee) · $400K · sent 8/15 to 17 · ✅ interested: names · ❌ passed: n · silent: n · [page link]"
3. **NEW JVs WORTH A LOOK** — scored JV intake, best score first, with Interested / clear buttons

**No agent round notes on DSP2** — it populates entirely from live data (sends, statuses, Aldo's board emojis). Randy opens it cold whenever; nothing waits on an analyst round.

### 14.5 JV scoring, badges, statuses, geo filter

- **Score 0-10** per JV deal: ratio = asking_price ÷ value, where value = redfin_price if present else county value × 1.08. Mapping: ratio ≤0.45 → 10, then roughly −1 per +0.05 of ratio, ≥0.95 → 0. Show ONLY the 0-10 number in UI (Randy thinks in the scale, never ratios).
- **Badges:** `DEV` (county improvement value < ~15% of total — land play, score unreliable), `VALUES DISAGREE` (redfin vs county differ >35%), `NEEDS INFO` (missing address or price), `OUT` (outside King/Snohomish/Pierce).
- **Auto-clear ONLY `OUT`.** Everything else keeps its score and stays visible — Randy explicitly fears false declines more than clutter.
- **Fix the geo filter:** 10 of 77 active JVs were Spokane/Kitsap/Thurston/Skagit/Mason (analyst cleared them by hand 8/14). Intake should catch these.
- **New JV status: `marketing`** — set when a JV deal's sends go out; needed for the homepage stat and for LIVE DEALS cards. (Existing statuses: new/interested/didnt_sell/cleared.)

### 14.6 Homepage

- **Business stats, two new counters mid-row** (row order = pipeline order): Leads Added · Leads Archived · **Ready for Dispo** · **Deals in Dispo** · Deals Assigned · Deals Closed.
  - Ready for Dispo = count of unsent queue rows.
  - Deals in Dispo = leads in `marketing_active` + JV deals in `marketing`. Status flips keep it honest — nothing is manually maintained.
  - **Deals in Dispo is clickable → deals index page.** This replaces the business-stats footer — remove the footer.
- **Dispositions dropdown card:** counter counts ONLY lines in Aldo's chunk (recognize by 🟢 on the line, i.e. 💰🟢 lines). Badge = count of ready-to-send rows, indicator **📤** (not the flag).

### 14.7 Bridge ops the analyst needs

- List queue rows (+ their composed messages)
- Edit/refine a queued message before send
- Fire the send wizard flow for a row with an explicit investor list (Randy approves in chat; same cascade as the in-app button)
- Read per-deal send/response tallies (for LIVE DEALS-style review in chat)

### 14.8 Out of scope for v9 (parked deliberately)

- Investor database growth (parked with Geoffrey/GENERAL)
- Any auto-sending without a human click/approval — never
- JV wholesaler outreach automation (Randy texts them himself)
