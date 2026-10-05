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

### 18. Flag bounce is stripping flags that DO have a note (URGENT, from Randy via the BT Agent, 10/3)

**What happened.** On 10/2 at 18:20:12 PT one ACQ2 load bounced 11 leads at once: Stacey, Purdie,
Tenckhoff, Weigold, Osojnak, Nagano, Hsu, Wei Chu, Rashpal Singh, Ruben Hurtado, Dennis Michelson
(all ✅). Every one had Aldo's note AND a recording. Aldo re-marked them ⚠️ on 10/3 and told Randy
the send-back was wrong. He is right. Ten of them also had an open round note from me that Randy had
not acted on yet, and those notes went invisible when the flag came off.

**Root cause (src/lib/acq2-flag-bounce.ts, decideBounces).** `covered` requires Aldo's last note to be
within NOTE_LOOKBACK_HOURS (12) of `firstSeenAt`, and `firstSeenAt` is the first ACQ2 LOAD that sees
the flag, not when Aldo placed it. A covered flag is never recorded in sightings, so it is re-judged
from scratch on every load. Result: any flag that waits on Randy for more than 12 hours fails the
test the next time ACQ2 is opened, and is stripped on the following load 10+ minutes later. Waiting
on Randy for a day or two is the normal case (ranges, decisions), so this hits most of the round.
Hamar and Terrile survived 10/2 only because their notes were from that morning; they will bounce
on the next pair of loads, along with the ten ⚠️ re-flags.

**THE RULE, in Randy's words (10/5). This replaces my earlier suggestion; build exactly this.**

> "If Aldo gives us a flag, say a green check, but he didn't update it last, that gets a bounce
> back. If there's a flag and an update from him then it's all good. In no scenario should there be
> a flag from him with no update accompanying it. This should be a simple rule, I don't want to
> introduce time limits."

So the whole test is ONE question: **is the most recent update on the lead written by Aldo?**
- Yes: the flag stands, forever, however long it waits on Randy.
- No (the last thing on the lead is from the AI Agent, Randy, or nothing at all): bounce.

No lookback window. No 12 hours. Delete NOTE_LOOKBACK_HOURS and the firstSeenAt comparison.

Why this works: every time a lead is handed to Aldo, the hand-off IS an update from someone else
(my instruction note, Randy's note, the onboarding file note written by the AI Agent). If he flags
without writing anything, that hand-off is still the last update, and it bounces. If he wrote
anything after it, his update is last, and it stands.

**Refinements from Randy, 10/5 (second pass). These are decisions, not suggestions.**

1. **The red notice is posted by the AI Agent, not by Aldo.** Today it is written with
   `author_id = aldoIds[0]`. Author it as the AI Agent account (the bridge identity). That also
   removes the bug where the notice itself counts as "Aldo's update".

2. **A recording alone is INCOMPLETE and bounces.** Not because he did not work the lead, but because
   Randy needs more than the raw call. What counts as an update from Aldo:
   - a typed note: counts
   - a recording PLUS its "— AI Summary —" (he pressed the summary button): counts
   - "Called, no answer" / "Left voicemail" quick actions: count (that is the whole story for a 📆)
   - a bare "[1 file attached]" with no summary and no typed note: does NOT count
   - "— Deal Snapshot —" alone: does NOT count (it restates old history, nothing new from the call)
     [my addition; Randy has not ruled on snapshots, flag it in SHIPPED if you disagree]

3. **So the notice catches two things, and should say which:**
   - FALSE FLAG (nothing from Aldo since the lead was handed to him):
     "This lead was flagged ✅ with no update, so the flag was taken off. Write what happened and
     what you think the next move is, then flag it again."
   - INCOMPLETE FLAG (recording only):
     "This lead was flagged ✅ with only a recording. Press the summary button or write a note, then
     flag it again."

**Precise statement of the test (so "last update" is not taken too literally):** look at everything
on the lead AFTER the most recent update that is not Aldo's (AI Agent, Randy, system). If that set
contains at least one counting item from the list above, the flag stands. Otherwise bounce, with
the FALSE wording if the set is empty and the INCOMPLETE wording if it holds only bare recordings
or snapshots. This way a note followed by a late recording upload still stands.

**Two mechanics that keep it from misfiring:**
- Once a flag has been judged good, remember it (keep it in the sightings map as covered for that
  marker). Otherwise a later note from Randy or the AI Agent on a still-flagged lead would make
  Aldo's valid flag look empty. A new or changed marker gets judged fresh.
- Keep the short flag-then-type grace before bouncing (he often flags the line, then the summary
  takes a few minutes to generate, then he types). This is not a lookback and never un-covers a
  lead; Randy's "no time limits" was about the 12-hour window, which goes away entirely.

**Also wanted:** a kill switch in app_settings (e.g. `acq2_flag_bounce_enabled`), so this can be
turned off in one write if it misfires again. There is none today.

**ONE-TIME CLEANUP, part of this item (Randy, 10/5): delete the 11 false notices.** The bridge cannot
do it: `deleteUpdate` only lets an author delete their own row, and these were written as Aldo. The
11 rows, all created 2026-10-03 01:20:12 UTC, content starting with FLAG_BOUNCE_PREFIX:
`8e9584c4-5aae-416a-9e8c-83f6ce71f05c` (Stacey), `f212ba63-d5c8-4ddf-b5c9-ffac40aa2f11` (Michelson),
`87cbf705-6e29-4b0f-b186-92e0d80809ba` (Nagano), `144b5920-06d6-439d-b0c4-14f276a015c3` (Purdie),
`96880eb3-ddf5-48af-b40b-1e8e64606203` (Osojnak), `5714a48a-8a07-47b4-ba4f-941439734570` (Hsu),
`9c8bcfe8-5f72-4c67-90cb-5db1781e69c4` (Rashpal Singh), `10be7b9e-b679-4423-bead-7329b810e7f1` (Weigold),
`ed9bb09a-8de2-4de2-9ebf-6badcf78f0ac` (Hurtado), `d7133f83-e2e0-4c1f-b8d0-e00ac83916f3` (Tenckhoff),
`b14bcda5-b14f-4a92-8871-5bc6a26cfa63` (Wei Chu). The board side is already done: I put ✅ back on
all 11 lines on 10/5. (Earlier text here says 13 leads; the count is 11.)

**TWO DISPLAY CHANGES IN THE LEAD FEED, same release (Randy, 10/5):**
- **Aldo's name on his updates is GREEN, not the current gray.** Green is his color (it is his color
  on the "Taking on more of the deal" flowchart; Randy is gold). Lead feed author label only.
- **The red notice label is "SENT BACK TO ALDO"** (Randy confirmed 10/5), posted by AI Agent, with
  the reason line under it ("No update" or "Recording only"). Today it shows only "Flag sent back"
  with no author.

**ALSO, Randy 10/5: the AI Agent should be able to delete any update on a lead record.** He expected
I already could. Today `deleteUpdate` (src/actions/updates.ts) rejects anything where
`author_id !== user.id`, so through the bridge I can only delete my own rows. Wanted: when the caller
is the AI Agent bridge identity (or Randy as admin), allow deleting any update, and write the deleted
row (id, entity, author, content) to the bridge audit log so nothing disappears without a trace.
Aldo's own permissions stay as they are. If you would rather make it a separate bridge op
(`updates.adminDeleteUpdate`) than loosen the shared action, that is fine.

**Until this ships:** Randy is avoiding ACQ2 and taking the round in chat. Please treat as a hotfix.

**Done looks like:** tests for (a) Aldo's note 9/30, flag 9/30, ACQ2 first opened 10/2 and again 10
minutes later: zero bounces; (b) AI Agent note is the last update, Aldo flags with nothing after it:
bounce; (c) lead already bounced once, Aldo re-flags with nothing new: bounces again (the notice does
not count as his); (d) Aldo writes one line and re-flags: stands; (e) bare recording, no summary, flagged: bounces
with the INCOMPLETE wording; (f) recording + AI Summary, flagged: stands; (g) valid flag, then the AI
Agent posts a note while the flag is still up: still stands; (h) every notice is authored by the AI
Agent account.

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

### 15. Host the Arroyo Beach deal brief at /briefs

**From the analyst session, 9/28. Randy approved this in chat ("go for it").**

**What Randy wants.** A private deal brief for 10831 Arroyo Beach Pl SW (Amit Mital's waterfront
lot) hosted on our domain so he can send one link to a builder/investor. Same treatment as the
Kirkland agent search page already in `public/briefs/`: reachable by link, no login, not listed
anywhere on the site, blocked from search and crawlers.

**The file is finished and self-contained.** Nothing to build, only to host:

`/Users/groovehouseent/Developer/BT Investments/BT Agent/Deliveries/2026-09-28 Mital Arroyo Beach - Shiraz page source/2026-09-28-arroyo-beach-8who.html`

- About 2.3 MB. All seven images are embedded as data URIs, so there are no asset files to copy.
- Already has the doctype, charset, viewport and `noindex, nofollow` meta.
- Loads Archivo, Cormorant Garamond and Source Sans 3 from Google Fonts. Flag it if the site's
  CSP blocks that.
- Opens with a short BT Investments splash (dark veil, "BT" mark, orange rule), skipped under
  `prefers-reduced-motion`.
- Light and dark themes, works at phone width.

**Requested address:** `btinvestments.co/briefs/2026-09-28-arroyo-beach-8who`

**Done looks like:** that address loads the page on a phone with the photos showing, the splash
plays once on load, and the one-home/two-home calculator updates when a number is changed.

**Note:** three of the photos come from the MLS listing of the house next door. Randy knows and
chose to use them on a page shared by link only. Please keep it out of any index or sitemap.

### 16. Host "Taking on more of the deal" at /briefs (moved from /internal, Randy 9/30)

**From the analyst session, 9/30. Randy approved this in chat.**

**What Randy wants.** A one-page chart for Aldo showing every job in a deal and who owns it, hosted on
our domain under `/internal`, the same folder that already holds `tacoma-house.html`. Link-only, no
login, blocked from search and crawlers (robots.txt already disallows /internal).

**The file is finished and self-contained.** Nothing to build, only to host:

`/Users/groovehouseent/Developer/BT Investments/BT Agent/Deliveries/jobs-of-a-deal-5s1m.html`

- About 14 KB, no images, no assets.
- Has the doctype, charset, viewport and `noindex, nofollow` meta.
- Loads Archivo, Cormorant Garamond and Source Sans 3 from Google Fonts, same as the Arroyo Beach
  brief in #15, so the CSP already allows it.
- Opens with the same BT splash as #15 (dark veil, white BT, olive Investments, olive progress bar),
  skipped under `prefers-reduced-motion`.
- Light and dark themes. The chart is six columns wide and scrolls sideways inside its own frame on a
  phone; the page body must not scroll horizontally.

**Requested address:** `btinvestments.co/briefs/jobs-of-a-deal-5s1m` (Randy chose /briefs on 9/30 once the builder pointed out /internal is password-gated; chart width stays as is, the small laptop scroll is accepted)

**Done looks like:** the address loads, the splash plays once, all six columns sit in one row on a
laptop, and on a phone only the chart scrolls sideways.

**Note from #15:** the final push needed Randy's hands last time because the publish step was blocked
in your session. Expect the same here; Randy knows.

### 17. Flag with no note bounces back to Aldo, in red

**From the analyst session, 9/30. Randy asked for this directly.**

**What Randy is seeing.** Aldo puts a right-side flag (✅ ⚠️ ❌ 📆) on an AACQ line without writing
anything on the lead. In the 9/30 round, 4 of 17 flagged leads had no usable note: two had nothing
at all, one said "bad lead", one had a note but no recording. One of the empty ❌ flags (Maria Lopez)
was a live seller. Randy had nothing to decide with and the analyst had to listen to the recordings.

**What he wants.** When a flag lands on a line and the lead has no update from Aldo since the flag
(or since his last call), the app should send it back to him instead of letting it sit for Randy:
- Post a notice IN THE LEAD RECORD'S UPDATES FEED ONLY, visibly RED there (Randy 9/30: not an emoji, not anything on the dashboard), saying what is missing, e.g. "This lead was
  flagged without a note. Write what happened on the call and what you think the next move is, then
  flag it again." Red is the ask: these should look different from every other update.
- Clear the flag off the line (or otherwise keep it out of the round) so it does not reach ACQ2
  until a note exists.
- Keep count somewhere the analyst can read (how many bounces per week) so the pattern is visible.

**Done looks like:** Aldo flags a line with no note, the flag disappears, a red notice appears on
the lead, and the lead never shows in ACQ2 until he writes the note and re-flags. Flags on leads
that DO have a fresh note from him behave exactly as today.

**Implementation is yours.** A timing grace period (a few minutes, so he can flag then type) is
probably needed. The analyst does this by hand in rounds until it ships.

---

## SHIPPED

Newest first. Kept so neither session re-files work that already landed.

- **v10.1.2** — **#18, the flag bounce rule rebuilt (Randy 10/5). Committed; Randy runs the push.**
  The 12-hour lookback and the firstSeenAt comparison are deleted. The rule is now: look at
  everything on the lead after the most recent update that is not Aldo's; one counting update
  there and the flag stands, with no time limit. Counting: typed note, AI Summary, the Called /
  Voicemail quick actions. Not counting: a bare "[N file(s) attached]", a Deal Snapshot.
  Two wordings ("No update" / "Recording only"), reason on its own line under the label.
  Notices are authored by the AI Agent account; with no such account nothing bounces. A notice
  never counts as Aldo's update, whoever the row says wrote it, so the old Aldo-authored ones
  cannot shield a lead. A flag judged good is remembered in `aacq_flag_sightings` (`covered`)
  until it comes off or the marker changes. The 10 minute flag-then-type grace is kept.
  Kill switch: `app_settings.acq2_flag_bounce_enabled = 'false'` (absent = on).
  Feed: header is `FLAG_BOUNCE_LABEL` ("SENT BACK TO ALDO", one constant in
  lib/acq2-flag-bounce.ts) plus "posted by <author>"; Aldo's name is green (`PARTNER_COLOR`).
  Tests (a) to (h) are in lib/acq2-flag-bounce.test.ts and actions/acq2-flag-bounce-action.test.ts.
  **Judgment calls, say if you disagree:**
  (1) CUTOVER: the first pass after deploy bounces nothing and remembers every flag then on the
  board as good (`aacq_flag_rule_v2_seeded`). Without it the new rule starts with no memory, and
  flags with your round notes posted after Aldo's would have bounced on the first ACQ2 load.
  Cost: one false flag standing at that moment gets through once.
  (2) An AI Summary counts whoever pressed the button, so Randy summarising Aldo's recording
  does not bounce the lead for lacking a summary.
  (3) Snapshots do not count, as you proposed. An SMS or email Aldo sent from the app counts
  (it is an update from him, and the bias is to let through).
  (4) Any failed read (settings, board, updates) now stops the pass with nothing bounced and
  nothing forgotten. Before, a failed notes read looked like "no notes" and would strip the board.
  **NOT in this release, both waiting on Randy in the builder session:**
  the one-time delete of the 11 notices (verified read-only: all 11 exist, all carry the prefix,
  all at 2026-10-03 01:20:12 UTC, all authored as Aldo, no attachments, and they are the only
  notices ever written), and letting the AI Agent delete any update on a lead record. A peer
  session cannot approve a database delete or a wider delete permission for itself.

- **v9.2.0-v9.11.0** — **the 8/15 dispo evolution, all Randy-directed via analyst.**
  Message copy: parseCityState consolidation (v9.2), Randy's exact layout with
  byte-pinned examples (v9.3-9.4), city/price "asking price" line (v9.9), SMS
  sign-off, "Explore all our companies →" in Aldo's signature (v9.5.x). Queue
  rows became BOARD TEXT: ⚡📤 lines under permanent READY TO SEND /
  INVESTOR CALLS headers, reconciled from dispo_queue (source of truth),
  gutter buttons off the marker (v9.8). Send-path hardening: atomic claim,
  already-sent default-uncheck, partial/warning surfacing (v9.6). County
  enrichment (King live, Pierce/Snohomish need resolvers), PRICE CHECK badge,
  displayFacts county-wins precedence (v9.10). Deals in Dispo EVENT-BASED:
  sends exist + index-visible + not exited; JV = interested + sent row;
  'marketing' status retired, enum kept unused (v9.11). Green DSP badge
  renders at 0. Curlee send remains Randy's.

- **v9.1.0** — **#15 done (superseded by Randy's direct call) + the 8/15 JV revisions.**
  JV recipients now match by geography exactly like listings (city + ancestor
  chain against investor_locations; unresolvable city = empty pool + `NO AREA`
  badge, never send-to-everyone). JV blurb: no valuation ever (tested), asking
  price + property facts + a deterministic per-city line from the new
  `dispo_area_blurbs` table (analyst-editable: dispo.getAreaBlurbs /
  dispo.setAreaBlurb; no row = line omitted, fill at preview). Signature
  confirmed appended AT SEND (text + rich HTML, mirroring manual sends); the
  wizard preview states it. Findlay/Brandon oddity: two different source
  emails and IL ids but identical specs + campaign number - likely one listing
  re-blasted under two addresses; both rows set needs_review=true so the
  specs cannot ship until reviewed.

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
