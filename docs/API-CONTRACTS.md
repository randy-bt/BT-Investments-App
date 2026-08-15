# API Contracts

Written for audit 001. The binding contracts are the **Zod schemas in
`src/lib/validations/`** — every input crosses one of them server-side, so
this document describes the shape of the system rather than duplicating
field lists that would drift. When this file and a schema disagree, the
schema is right.

## The universal Server Action contract

All internal reads and writes go through Server Actions in
`src/actions/` (24 modules: leads, investors, updates, attachments,
listing-pages, follow-up, acq2, agreements, messaging, search, and so
on). Every action returns the same discriminated union:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Rules every action follows:

- Auth first: `requireAuth()` or `requireAdmin()` from `src/lib/auth.ts`.
  36 modules gate this way; an unauthenticated call returns
  `{ success: false }`, never throws.
- Inputs are `unknown` at the boundary and parsed with the matching Zod
  schema before any DB touch.
- Database access is the Supabase query builder or named-parameter RPCs
  only — no string-built SQL.

## HTTP endpoints

Routes exist only where an outside party calls in, or where the work does
not fit an action (streaming, long-running).

| Route | Auth | Contract |
| --- | --- | --- |
| `POST /api/auth/callback` | Google OAuth code | Exchanges the code, creates the user row on first login, domain-restricted to `@btinvestments.co`. Rate-limited 10/min/IP. Redirects; never returns JSON. |
| `POST /api/forms/submit` | none (public) | Seller/buyer form intake. Rate-limited 5/min/IP. Zod-validated; writes `public_form_submissions`; notifies via Resend. |
| `POST /api/signal/submit` | none (public) | Signal intake, same shape: 5/min/IP, Zod, upload caps (25MB/file, 5 files). |
| `POST /api/summarize` | session | Audio attachment → Anthropic summary → feed note. Strips `#range` / `#our_current_offer` before saving (v8.1.0 guard). |
| `POST /api/properties/scrape` | session | Redfin scrape into property fields. |
| `POST /api/webhooks/resend` | webhook secret | Permanent bounces only → red feed entry on the matching lead. |
| `/api/follow-ups/*`, `/api/jv/*`, `/api/news/*` | cron secret | GitHub Actions entry points. **Must be in the `src/proxy.ts` allowlist** or they 307 to login. |

## Field-write policy worth knowing

Two lead fields are human-only by contract: `range` and
`our_current_offer` (BT's own position). The summarize route strips their
hashtags server-side; the parser in `ActivityFeed` still applies them when
Randy types them by hand. `asking_price`, `condition`,
`selling_timeline`, `occupancy_status` (what the seller said) may
auto-fill from summaries.
