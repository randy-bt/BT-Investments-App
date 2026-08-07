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

### 6. Due follow-ups have not moved to AACQ since Aug 1 — who owns the sweep?

**From the builder session, 8/6, raised by Randy.**

Randy's report: due-dated leads used to land on AACQ the night before, and nothing has moved
since Aug 1. Confirmed in the data. As of 8/6 there are **20 lines on the follow-ups board
dated today or earlier** that are still sitting there:

- **Aug 1** (11): Jon Alexander, Guy Phu, Robin Schoenfield, Huiling Chen, Geoffrey Mcgrath,
  Matthew Usinger Johnston, Karen Hildt, Jeffery Cissell, Charles Lane, Vernon Hodgson,
  Jan Middleton (Eric)
- **Aug 3** (1): Debbie Schubert
- **Aug 5** (5): Aaron Taylor, Andrea Elkins, Jackie Dempere, Mary Armanious, Victor Armstrong
- **Aug 6** (3): Ling Drost (Agent), Constance Kelsey, Alexander Thole

**The builder checked first, and this is not an app fault.** There is no scheduled job, no
cron and no server action anywhere in the app that moves a due follow-up back to AACQ.
`vercel.json` has two crons (news refresh, JV scan) and neither touches the boards.
`up-next.ts` is driven by the ✅ marker, not by dates. The bridge is healthy: writes to the
follow-ups board succeeded on 8/3 at 9,252 bytes, so the 8/1 8KB bug is genuinely fixed and
is not what stopped this. The audit log shows the last write to `follow_ups` was
**8/3 23:55**, from a `followUp.triggerFollowUp` call adding a lead — nothing has swept it
since.

So the sweep was the analyst session doing it by hand during rounds, and it lapsed. **Two
things to decide:**

1. **Does the analyst want to keep owning it, or should the builder automate it?** If you
   want it automated, say so here and the builder will add a dated sweep. It is a small job
   now that the parsing is fixed. If you keep it, it wants to be an explicit step in the
   round, because right now nothing anywhere records that it is supposed to happen.

2. **Do not drive the sweep off `leads.next_follow_up_date` alone.** Of those 20 due leads,
   **13 have `next_follow_up_date = NULL`** (Aaron Taylor, Andrea Elkins, Charles Lane,
   Geoffrey Mcgrath, Guy Phu, Huiling Chen, Jackie Dempere, Jeffery Cissell, Jon Alexander,
   Karen Hildt, Mary Armanious, Matthew Usinger Johnston, Robin Schoenfield). Only lines
   created through `followUp.triggerFollowUp` get the column written; hand-typed board lines
   never do. A DB query would have found 7 of 20 and looked like it worked.

**Related app fix, shipped in this push (v7.29.0):** Randy guessed the wording was involved
and he was half right. `parseFollowUpDate` never matched **"Sept"** — the pattern was
`sep(?:tember)?` between word boundaries, which matches "sep" and "september" but not the
four-letter form, and "Sept" is what the board actually uses (**22 lines**). Those lines
parsed as `null`, so `findChronologicalInsertPos` walked straight past them and filed new
follow-ups in the wrong place. That is why **Ann Cooper, Roxanne Raubacher and Linda Edson,
all "August 30th", currently sit between "Sept 30th" and "Oct 1st"**. Fixed and regression-tested
against every month spelling on the live board.

Note this only ever affected *insert position*, so it does not explain the stall — the Aug 1–6
lines are at the top of the board where nobody could miss them. But it does mean **the
follow-ups board is not in date order today**, so a sweep that reads top-down and stops at the
first future date will miss the three August 30th lines. Re-sorting the existing board is a
one-off content edit the builder did not make unasked; say the word and it gets done.

---

## SHIPPED

Newest first. Kept so neither session re-files work that already landed.

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
