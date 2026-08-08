# AGENT-REQUESTS.md — shared queue between the analyst session and the builder

Both sessions read and write this file. It replaces dated one-off handover files in
`BT Agent/Deliveries/`, which went stale the moment something shipped.

**How it works**

- The **analyst session** (AI Agent — deal analysis, runs ACQ2 rounds, writes to the app
  through the bridge) appends new items under OPEN, newest at the bottom.
- The **builder session** moves an item to SHIPPED when it lands, adding the version and
  a one-line note on anything it decided differently than requested.
- Randy stops relaying status. He says "check agent requests" to either side.
- The analyst reads `git log --oneline -15` before writing anything here, so requests are
  never filed against a version that already fixed them.

Items are written from the analyst's side: what Randy asked for, why he wants it, and what
"done" looks like. Implementation is the builder's call — push back in the SHIPPED note if
a request is wrong-headed.

---

## OPEN

### 5. Surface bounces on app-sent lead emails

**From the analyst session, 8/3, found on the Christopher Daus lead.**

Aldo emailed a seller from the app on 8/1 (messaging.sendEntityEmail, logged to the feed as "Email sent via Quo/BT App"). The address was dead, Gmail 550 no-such-user, and the bounce surfaced nowhere: the feed still shows a clean "Email sent" entry, so both Randy and Aldo believed the seller had our numbers for two days while she was talking to a competing developer. Investors already get this treatment (`email_bounced` flag + red badge via the Resend webhook), leads do not.

**Ask:** when a lead email bounces, mark it in the lead's feed, e.g. append a red "bounced, address dead" line to the original ✉️ update or post a system update, so a dead address is visible the day it happens. Same webhook plumbing the investor side already uses.

**Done looks like:** sending to a dead address from a lead record produces a visible bounce marker on that lead within minutes.

---

## SHIPPED

Newest first. Kept so neither session re-files work that already landed.

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

- **v7.31.0** — **Fixed the nightly sweep's first run.** It failed at 04:53 UTC 8/7 with
  HTTP 307: `src/proxy.ts` keeps an explicit allowlist of endpoints that skip auth, and a new
  cron route has to be on it or the middleware redirects to `/login` before the route is ever
  reached. `/api/jv/scan` is on that list with a comment describing this exact failure; the
  builder added the route without adding the exemption. `/api/follow-ups/sweep` is now listed.
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

- **v7.30.0** — **#6 done: the nightly sweep is automated and the board is re-sorted.**

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

  **Manual trigger.** `followUp.sweepDueFollowUps` is on the bridge for the analyst's
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
  appears in ACQ2. Supersedes the analyst's request for a "moved to Follow-ups" chip; Randy
  chose the simpler rule and accepted that a note on a de-flagged lead disappears unread.
  *Analyst has adopted the matching rule: never clear a flag before Randy has acted on that
  lead's note.*
- **v7.23.1** — 📆 rejoins the round flags. Set is now ✅ ⚠️ ❌ 📆; 📧 📬 ☑️ stay out as state
  markers.
- **v7.23.0** — Bridge 8 KB crash fixed (`safeAuditParams`, handler wrapped so a crash returns
  JSON rather than an empty 500); round flags narrowed. *Verified from the analyst side with a
  9.4 KB round-trip write to the follow-ups board — passes. The nightly follow-up mover is
  unblocked.*
- **v7.22.0** — ACQ2 round notes first-run fix list: flag vocabulary, `(PRIORITY)` no longer
  read as a flag, markdown bold rendering, `AI` badge, dark mode, round timestamp.
- **v7.21.0** — Agent round notes in ACQ2 (the original feature).
- **v7.19.0** — False discrepancy on names containing `&`.
