# HANDOVER.md — How to Think About This Project

A brain dump for future AI sessions working on the BT Investments app. Not a
technical reference (CLAUDE.md covers commands and architecture) — this is
how to *reason* here: how to interpret Randy's requests, how to break down
work, and how to verify it. Written July 2026 after ~3 months of near-daily
sessions from v4.x to v6.2.

---

## 1. Who you're working for

Randy owns BT Investments (real-estate wholesaling: acquire leads, market
properties, assign to investors). His partner Aldo (aldo@btinvestments.co,
admin role, no yellow highlight in UI) is the only other user. That's the
entire user base — design for exactly two people who trust each other.

Randy **voice-dictates** his messages. Expect typos ("wuestion", "jsut",
"tthen"), run-ons, and missing punctuation. Never mirror the typos back or
ask him to clarify spelling — reconstruct intent. If a dictated word is
genuinely ambiguous ("Otto" = Aldo), context from memory files resolves it.

He **trusts your judgment**. "Feel free to save these somewhere" means pick
the right place. "A little green toggle pill or something" means design it
yourself. He reviews outcomes, not diffs. This trust means:
- Don't ask which of two reasonable approaches to take — pick one, say
  which you picked and why in one sentence, and build it.
- DO stop and ask when the decision is genuinely his: spending money,
  deleting data, anything customer/investor-facing, anything touching
  email deliverability (see §6).

He says "push when complete" or asks "did you push?" — committing directly
to `main` and pushing is the normal workflow. No branches, no PRs, no
review gates. That makes YOU the review gate: verify before pushing.

## 2. How to interpret requests

**The stated feature is usually a symptom of a workflow need.** "Add a
copy-address button" is really "I paste addresses into other tools all
day." When you understand the workflow, you'll make ~3 small decisions per
feature that Randy never specified, and you should make them in favor of
*less friction for Randy*, not configurability.

**Requests arrive as deltas, not specs.** "It should show below the
original number" is a full spec by his standards. Find the thing he's
referring to (it's usually the feature you just built), infer the rest from
how the surrounding UI already works.

**"Is it accurate?" questions are audits, not reassurance-seeking.** When
he asked whether the usage monitor was accurate, the right answer involved
SQL against prod, cross-checking Anthropic's own billing API, and finding
that 92% of history was invisible. If he questions a number, *reconcile it
against an independent source* before defending it. He has been right every
time he smelled something off ("theres no way its 800+" — he was right;
"did you check other numbers or only the one that i sent to..." — he was
right).

**Scope words matter:** "extensive and accurate" / "thorough" = audit-grade
work, use subagents. "Real numbers" = he wants estimates with concrete
figures, not hedging. "Okay last thing for now" = wrap up cleanly, version
bump often follows. "Wrap it up" mid-task = deliver what's verified, list
what's unverified, stop burning tokens.

**Version bumps are releases.** He asks for them explicitly ("update the
version to 6.1"). Version lives in TWO places: `package.json` and
`src/components/VersionLabel.tsx` (`CURRENT_VERSION` — drives the "new
version" dot via localStorage). Bump both, always.

## 3. Hard rules (violating these = rework)

1. **Dark mode**: every new UI element ships `dark:` Tailwind variants. Randy
   uses dark mode; missing variants are bugs he will see immediately.
2. **Public repo**: never commit secrets, API keys, or the signature/initials
   images (those live in the private Supabase `agreements` bucket). Env
   values go to `.env.local` + `vercel env add`.
3. **Vercel Hobby limits**: crons must be daily or slower, and both cron
   slots are used (news 0 15 * * *, jv/scan 0 16 * * *). A sub-daily cron
   in vercel.json **silently breaks ALL deploys** (this happened June
   26–July 2 and went unnoticed for a week). Need something more frequent?
   Piggyback on page loads with a freshness gate (see billing sync in
   `src/lib/billing.ts`) or use an external scheduler.
4. **'use server' files** may only export async functions. Constants go in
   a non-action module or stay file-local.
5. **PostgREST caps un-limited selects at 1000 rows silently.** Any
   aggregate over a growing table goes in a SQL function called via
   `supabase.rpc()`, not JS iteration over `.select()` results.
6. **Timezones**: Randy is in Washington state. "Today" and month buckets
   are **America/Los_Angeles**, never server UTC.
7. **Vercel env quirk**: some values carry a literal trailing `\n`. Strip
   with `.replace(/\\n$/, '').trim()` when reading `process.env`.
8. **ActionResult<T>** for every server action. UI never throws on failure;
   it shows `error` inline.
9. **Naming**: "Lead Record" (acquisitions), "Investor Record"
   (dispositions), "Marketing Page" (never "Listing Page" in UI copy —
   the code still says listing_pages; leave the code, fix the copy).
10. **Feed content markers are load-bearing.** ActivityFeed detects entry
    types by content prefix: `— Deal Snapshot —`, `— AI Review —`,
    `✉️ Email sent via BT App`, `💬 SMS sent via Quo`, `[N file(s)
    attached]`. Changing these strings breaks rendering of *historical*
    entries. Treat them as a schema.

## 4. How to break down problems

**Debug = reconcile two sources of truth.** The pattern that has cracked
every hard bug here: find two independent measurements of the same fact and
diff them. Usage monitor vs prod SQL. Our cost estimates vs Anthropic's
usage report (which proved the $835 was subscription-covered Claude Code,
not cash). The UI's "Missing Audio" vs actual storage contents (files were
fine; the display format string was wrong). When numbers disagree, neither
is "the bug" yet — instrument until you know which layer diverges.

**Fix root causes in data, not renderers.** When feed entries misrendered,
the fix was the content format written going forward AND a backfill of old
rows — not a more forgiving parser.

**For features: spec → plan → build with subagents.** Randy's preference is
subagent-driven development (fresh implementer per task, review each task).
Don't re-ask which approach; he always wants subagent-driven. For small
changes (< ~100 lines), just build inline — process overhead isn't worth it.

**Before touching shared surfaces, enumerate consumers.** Known traps:
- Search row shape → three renderers: HomeSearch, SearchCommand, InlineSearch.
- `getUsageStats` return shape → UsageMonitor AND BusinessStats AND
  HomeBusinessStats consume it.
- Agreements filename format → parsed back by `shortLabel` in the database
  tables.
- Dashboard notes content → parsed by follow-up transforms (emoji
  stripping, lead-line matching).

**External APIs: verify with curl before writing code.** Quo, Resend,
Anthropic admin, OpenAI admin — every integration here started with a curl
proving the endpoint, auth style, and response shape. Quo uses the raw key
in `Authorization` (no Bearer). Anthropic admin uses `x-api-key` +
`anthropic-version`. OpenAI admin uses `Bearer`. Docs moved to
platform.claude.com for Anthropic.

## 5. How to verify work

Minimum bar before telling Randy something is done:
1. `npx tsc --noEmit` — must be clean.
2. `npx vitest run` — all tests pass (166 as of v6.2; 562 as of v9.25.0). New pure logic
   (parsers, transforms, computations) gets tests; UI glue doesn't need them.
3. `npm run build` for risky changes (imports across server/client boundary,
   new routes). Note: build can OOM on Randy's iMac — retry with
   `NODE_OPTIONS="--max-old-space-size=8192"`.
4. For data features: run the actual query/sync against prod and look at
   real output (Supabase MCP `execute_sql` is available and expected to be
   used — this is prod; SELECTs are safe, mutations need care).
5. Commit message = one-line summary + body explaining why. Push. Tell
   Randy it's pushed and deploying — he tests in prod.

**When a claim matters (cost figures, "it's fixed"), show the receipts** —
the reconciliation table, the test output, the prod row counts. Randy reads
outcomes, and concrete numbers are what he trusts.

**Report failures plainly.** If something is broken or unverified, say so
before he finds out. He handles "this part doesn't work yet" fine; he does
not handle discovering it himself a week later (see: silent deploy failures).

## 6. Danger zones (learned the hard way)

- **Email/DNS**: the domain btinvestments.co runs real business email
  (Google Workspace) with DNS now on Vercel nameservers (managed via
  `npx vercel dns`). Any DNS change risks breaking email — his exact words:
  "our email is so important". Stage MX records first, verify, then switch.
- **Deploys can fail silently.** After pushing, if the change matters,
  check the deployment (Vercel MCP `get_deployment` / `list_deployments`).
  A rejected vercel.json (e.g. sub-daily cron) fails every subsequent
  deploy with no email to Randy.
- **The agreements module produces legal documents.** Changes there get the
  full review pipeline (deterministic checks + AI review + "REVIEW FIRST"
  filenames). Never remove the pre-send review friction. The buyer
  signature/initials are pre-stamped; the templates are Google Docs the
  service account edits (bt-agreements-generator@bt-investments-app-agreements
  .iam.gserviceaccount.com has Editor on both PSA templates).
- **Quo calling is SCRAPPED.** Randy explicitly killed auto-recording calls
  ("yeah nah lets scrap this"). Do not re-propose it.
- **Google Cloud billing is OFF.** Maps use the free Embed API as a
  workaround; address autocomplete is degraded. When Randy re-enables
  billing, revert maps to interactive JS API + restore Places autocomplete.
  Don't build new features on the JS API until then.
- **Bulk operations on prod data**: dry-run first, show the plan (which 21
  leads, which files), get his "lets do it", then execute with per-item
  logging and a verification pass at the end. He appreciated exactly this
  flow on the audio backfill.

## 7. Current state pointers (July 2026)

> **STALE as of 2026-09-09 (v9.25.0).** This section was a point-in-time
> snapshot at v6.2.0 and has not been maintained across the ~170 commits
> since. Treat every item below as "was true in July", verify before relying
> on it. Sections 1 through 6 and 8 are durable guidance and still hold.
> Known drift: the version, the test count, and the glow-animation removal
> note (that was pegged to v7).

- v6.2.0. Glow animations on Quo/Email buttons are temporary — remove at v7
  (classes `glow-pulse-quo`, `glow-pulse-grey` in ActivityFeed).
- JV email intake is DORMANT: built, ships with cron, but needs Randy's
  Gmail app password + env (JV_IMAP_USER/JV_IMAP_PASSWORD) + settings keys
  (`jv_intake_enabled='true'`, `jv_start_cutoff`, `jv_last_uid='0'`).
- Usage monitor: fully rebuilt, cross-validated against provider billing
  APIs (admin keys in env: ANTHROPIC_ADMIN_KEY, OPENAI_ADMIN_KEY). Anthropic
  actuals come from the *usage report* (not cost report — that blends in
  subscription-covered Claude Code at list price). Randy still needs to
  fill in Fixed Monthly Costs (Supabase $25 confirmed; Quo, Workspace,
  Claude subscription, domain pending).
- Anthropic org has 4 keys: two are this app ("BTi App - News Module",
  "CC Onboarding Summarizer"); "diet-app" and "PICCOLO" are Randy's other
  projects. All spend is blended in the default workspace; a dedicated
  BT workspace/project at both providers is discussed-and-deferred.
- `generateLeadAIReview` (src/actions/lead-ai-review.ts) is dead code —
  superseded by Deal Snapshot. Feed still renders its historical entries.
- Memory files at ~/.claude/.../memory/ are the cross-session state. Keep
  them current — they are how the next session knows any of this.

## 8. Tone

Randy is friendly, casual, quick to say "perfect" and "cheers". Match it:
short, plain answers; lead with the outcome; numbers in tables; no
corporate hedging. When he's frustrated ("nothing seems truly accurate
here"), don't apologize in paragraphs — go get the ground truth and come
back with a reconciliation that ends the argument.
