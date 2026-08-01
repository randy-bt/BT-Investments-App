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

### 1. Show last-update author and time in the ACQ2 dropdown

**Requested by Randy, 8/1.**

In a lead's expanded dropdown, add a small line showing **who posted the most recent update
on that lead, and when** — e.g. `Aldo Gallegos · 3h ago`, `AI Agent · yesterday`.

Randy's reasoning, his words: *"It changes the context if I'm able to see if the last update
was you or Aldo."* If the newest update is the AI Agent's, the lead is waiting on someone to
act on an instruction that already exists. If it is Aldo's, something new came in and the
situation may have moved since the note was written. Today he has to open the lead record to
tell which, which is exactly the trip into the app that ACQ2 rounds exist to avoid.

Keep it visually quiet — small secondary text inside the dropdown, not a badge competing with
the note body. Reuse the app's existing author colouring (AI Agent renders purple, `#a855f7`)
so the source is recognisable without reading it.

**Done looks like:** Randy can tell, without expanding anything further or leaving ACQ2,
whether a lead's newest activity came from Aldo or from the agent, and roughly how old it is.

---

## SHIPPED

Newest first. Kept so neither session re-files work that already landed.

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
