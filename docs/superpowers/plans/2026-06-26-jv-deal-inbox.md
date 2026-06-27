# JV Deal Inbox + Email Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single "JVs" inbox where inbound JV/wholesale deals land as cards (auto from a dedicated Gmail, plus manual add), so Randy can triage them fast (Interested / Didn't Sell / Clear) before they slip through the cracks.

**Architecture:** New `jv_deals` + `jv_deal_events` tables. A Vercel cron polls a dedicated JV Gmail over IMAP (`imapflow`), a cheap Claude model classifies+extracts deals, they're deduped by normalized address against active JV deals and enriched with a Redfin estimate, then inserted as cards. A new admin-only `/app/jvs` page renders the cards with three triage actions + a manual-add form + an archive; an activity log lives in Settings.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS), Server Actions, `imapflow`, Anthropic SDK (`claude-haiku-4-5-20251001`), Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-jv-deal-inbox-design.md`. This slice = inbox + email + manual add only. Out of scope: website scrapers, Investor Lift, SMS, teammate assignment.
- **Access:** `/app/jvs`, all JV server actions, and the Settings JV section are **admin-only** (`requireAdmin` in actions; `user.role !== "admin"` redirect in the page; nav item shown only when `isAdmin`). This covers Randy (admin) + Aldo (admin role / partner email).
- **Dedupe scope:** ONLY against active JV deals (`status != 'cleared'`). Never touches leads/investors/listing_pages.
- **Default to inclusion:** ambiguous-but-deal-like emails still create a card flagged `needs_review`; never silently dropped.
- **Dark mode:** every new UI element ships `dark:` Tailwind variants (match `DealsSentPanel.tsx`).
- **Server Action shape:** `'use server'`, `try/catch`, return `ActionResult<T>` from `src/lib/types.ts`. No `revalidatePath` (codebase uses client refresh / `force-dynamic`).
- **Migrations:** next number is `065`. Reuse the existing `set_updated_at()` trigger function. Enable RLS with `authenticated` read + manage policies (match `060_deal_sends.sql`). Applied via Supabase MCP `apply_migration`, project ref `xgwmvdizqnvrswsdsljh`.
- **Costs:** IMAP polling is free; AI runs only on new messages with `claude-haiku-4-5-20251001`; Redfin is a free HTML scrape (do NOT use the OpenAI Zillow/county path). Route all model calls through `logApiUsage`.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/065_jv_deals.sql` | `jv_*` enums, `jv_deals`, `jv_deal_events`, indexes, RLS, triggers |
| `src/lib/types.ts` (modify) | `JvDeal`, `JvDealEvent`, `JvDealStatus`, `JvSourceChannel`, `JvDealEventType` types |
| `src/lib/validations/jv.ts` | zod schema for manual-add input |
| `src/lib/jv/dedupe.ts` | `normalizeAddress`, `isDuplicateAddress`, `deriveArchiveBadges` (pure) |
| `src/lib/jv/extract.ts` | `extractDealsFromEmail()` — Claude classify+extract |
| `src/lib/jv/imap.ts` | `fetchNewJvMessages()` — connect Gmail IMAP, fetch unseen-since-marker |
| `src/lib/scraper.ts` (modify) | export `scrapeRedfinValue(address)` (already exists internally) |
| `src/actions/jv-deals.ts` | list / triage / restore / manual-add / events server actions |
| `src/app/api/jv/scan/route.ts` | cron route: orchestrate fetch → extract → dedupe → enrich → insert |
| `src/app/app/jvs/page.tsx` | admin-gated server page; fetches active + archived deals |
| `src/app/app/jvs/client.tsx` | inbox client: card list, actions, archive toggle, manual-add |
| `src/components/JvDealCard.tsx` | one card (states: new/interested=green/didnt_sell=orange) |
| `src/components/AppNavbar.tsx` (modify) | add admin-only "JVs" nav item after Dispositions |
| `src/app/app/settings/jv-activity-log.tsx` | activity-log section component |
| `src/app/app/settings/page.tsx` (modify) | add JV CollapsibleCard |
| `vercel.json` (modify) | add `*/10 * * * *` cron for `/api/jv/scan` |
| Tests | `src/__tests__/lib/jv/dedupe.test.ts`, `src/__tests__/lib/jv/extract.test.ts` |

Build order ships the **manually-usable inbox first** (Tasks 1–8, no credentials needed), then the **email auto-intake** (Tasks 9–11, needs Gmail creds).

---

### Task 1: Database migration (`jv_deals`, `jv_deal_events`)

**Files:**
- Create: `supabase/migrations/065_jv_deals.sql`

**Interfaces:**
- Produces tables `jv_deals` and `jv_deal_events` and enums `jv_source_channel`, `jv_deal_status`, `jv_deal_event_type`, consumed by every later task.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 065_jv_deals.sql — JV deal inbox (email + manual intake)

CREATE TYPE jv_source_channel AS ENUM ('email', 'manual', 'website', 'investorlift', 'sms');
CREATE TYPE jv_deal_status     AS ENUM ('new', 'interested', 'didnt_sell', 'cleared');
CREATE TYPE jv_deal_event_type AS ENUM ('received', 'interested', 'didnt_sell', 'cleared', 'restored');

CREATE TABLE jv_deals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_channel     jv_source_channel NOT NULL,
  source_name        TEXT,
  source_url         TEXT,
  source_ref         TEXT,                       -- RFC822 Message-ID (email); NULL for manual
  address            TEXT,
  address_normalized TEXT,
  asking_price       TEXT,
  redfin_price       INTEGER,
  redfin_url         TEXT,
  note               TEXT,
  raw_excerpt        TEXT,
  status             jv_deal_status NOT NULL DEFAULT 'new',
  needs_review       BOOLEAN NOT NULL DEFAULT false,
  extra              JSONB,
  created_by         UUID REFERENCES users(id),  -- NULL = system/email intake
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency: never ingest the same email twice. Partial unique so manual rows (NULL) don't collide.
CREATE UNIQUE INDEX jv_deals_source_ref_key ON jv_deals(source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX jv_deals_status_idx ON jv_deals(status);
CREATE INDEX jv_deals_address_normalized_idx ON jv_deals(address_normalized);
CREATE INDEX jv_deals_created_at_idx ON jv_deals(created_at DESC);

CREATE TRIGGER jv_deals_updated_at
  BEFORE UPDATE ON jv_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE jv_deal_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jv_deal_id  UUID NOT NULL REFERENCES jv_deals(id) ON DELETE CASCADE,
  event_type  jv_deal_event_type NOT NULL,
  actor_id    UUID REFERENCES users(id),         -- NULL = system
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jv_deal_events_jv_deal_id_idx ON jv_deal_events(jv_deal_id);
CREATE INDEX jv_deal_events_created_at_idx ON jv_deal_events(created_at DESC);

ALTER TABLE jv_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jv_deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read jv_deals" ON jv_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage jv_deals" ON jv_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read jv_deal_events" ON jv_deal_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage jv_deal_events" ON jv_deal_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (project `xgwmvdizqnvrswsdsljh`, name `jv_deals`). The controller runs this after confirmation.

- [ ] **Step 3: Verify**

Run via Supabase MCP `execute_sql`: `select count(*) from jv_deals; select count(*) from jv_deal_events;`
Expected: both return `0` (tables exist, empty).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/065_jv_deals.sql
git commit -m "feat(jv): add jv_deals + jv_deal_events schema"
```

---

### Task 2: Types + manual-add validation

**Files:**
- Modify: `src/lib/types.ts` (append near the other row types)
- Create: `src/lib/validations/jv.ts`

**Interfaces:**
- Produces: `JvDeal`, `JvDealEvent`, `JvDealStatus`, `JvSourceChannel`, `JvDealEventType`, and `manualJvDealSchema`. Consumed by actions, page, components, extraction.

- [ ] **Step 1: Add types to `src/lib/types.ts`**

```ts
export type JvSourceChannel = 'email' | 'manual' | 'website' | 'investorlift' | 'sms'
export type JvDealStatus = 'new' | 'interested' | 'didnt_sell' | 'cleared'
export type JvDealEventType = 'received' | 'interested' | 'didnt_sell' | 'cleared' | 'restored'

export type JvDeal = {
  id: string
  source_channel: JvSourceChannel
  source_name: string | null
  source_url: string | null
  source_ref: string | null
  address: string | null
  address_normalized: string | null
  asking_price: string | null
  redfin_price: number | null
  redfin_url: string | null
  note: string | null
  raw_excerpt: string | null
  status: JvDealStatus
  needs_review: boolean
  extra: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type JvDealEvent = {
  id: string
  jv_deal_id: string
  event_type: JvDealEventType
  actor_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
```

- [ ] **Step 2: Create `src/lib/validations/jv.ts`**

```ts
import { z } from 'zod'

export const manualJvDealSchema = z.object({
  address: z.string().trim().min(1, 'Address is required'),
  source_name: z.string().trim().min(1, 'Source is required'),
  asking_price: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export type ManualJvDealInput = z.infer<typeof manualJvDealSchema>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/validations/jv.ts
git commit -m "feat(jv): add JV types and manual-add schema"
```

---

### Task 3: Pure helpers — normalize, dedupe, archive badges (TDD)

**Files:**
- Create: `src/lib/jv/dedupe.ts`
- Test: `src/__tests__/lib/jv/dedupe.test.ts`

**Interfaces:**
- Produces:
  - `normalizeAddress(address: string | null | undefined): string` — lowercased, trimmed, punctuation stripped, whitespace collapsed, common abbreviations normalized (st/street, ave/avenue, etc.), returns `''` for empty.
  - `isDuplicateAddress(candidate: string | null, activeNormalized: string[]): boolean`
  - `deriveArchiveBadges(events: Pick<JvDealEvent,'event_type'>[]): { wasInterested: boolean; wasDidntSell: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeAddress, isDuplicateAddress, deriveArchiveBadges } from '@/lib/jv/dedupe'

describe('normalizeAddress', () => {
  it('lowercases, trims, strips punctuation/commas and collapses whitespace', () => {
    expect(normalizeAddress('  310 110th Pl SE, Bellevue, WA  ')).toBe('310 110th pl se bellevue wa')
  })
  it('normalizes common street-type abbreviations', () => {
    expect(normalizeAddress('123 Main Street')).toBe(normalizeAddress('123 Main St'))
    expect(normalizeAddress('5 Oak Avenue')).toBe(normalizeAddress('5 Oak Ave'))
  })
  it('returns empty string for nullish', () => {
    expect(normalizeAddress(null)).toBe('')
    expect(normalizeAddress(undefined)).toBe('')
  })
})

describe('isDuplicateAddress', () => {
  it('matches regardless of formatting', () => {
    const active = [normalizeAddress('310 110th Pl SE, Bellevue, WA')]
    expect(isDuplicateAddress('310 110th place se bellevue wa', active)).toBe(true)
  })
  it('is false for a new address or empty candidate', () => {
    const active = [normalizeAddress('1 A St')]
    expect(isDuplicateAddress('2 B Ave', active)).toBe(false)
    expect(isDuplicateAddress('', active)).toBe(false)
    expect(isDuplicateAddress(null, active)).toBe(false)
  })
})

describe('deriveArchiveBadges', () => {
  it('flags interested and didnt_sell from prior events', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received' }, { event_type: 'interested' },
      { event_type: 'didnt_sell' }, { event_type: 'cleared' },
    ])).toEqual({ wasInterested: true, wasDidntSell: true })
  })
  it('is all-false for a deal only received then cleared', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received' }, { event_type: 'cleared' },
    ])).toEqual({ wasInterested: false, wasDidntSell: false })
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/__tests__/lib/jv/dedupe.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/jv/dedupe.ts`**

```ts
import type { JvDealEvent } from '@/lib/types'

const STREET_ABBR: Record<string, string> = {
  street: 'st', avenue: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd',
  lane: 'ln', court: 'ct', place: 'pl', terrace: 'ter', parkway: 'pkwy',
  highway: 'hwy', circle: 'cir', square: 'sq', trail: 'trl',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
}

export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return ''
  const cleaned = address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((tok) => STREET_ABBR[tok] ?? tok)
    .join(' ')
}

export function isDuplicateAddress(candidate: string | null, activeNormalized: string[]): boolean {
  const norm = normalizeAddress(candidate)
  if (!norm) return false
  return activeNormalized.includes(norm)
}

export function deriveArchiveBadges(
  events: Pick<JvDealEvent, 'event_type'>[],
): { wasInterested: boolean; wasDidntSell: boolean } {
  return {
    wasInterested: events.some((e) => e.event_type === 'interested'),
    wasDidntSell: events.some((e) => e.event_type === 'didnt_sell'),
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/__tests__/lib/jv/dedupe.test.ts`
Expected: PASS (3 suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/jv/dedupe.ts src/__tests__/lib/jv/dedupe.test.ts
git commit -m "feat(jv): address normalization, dedupe, archive-badge helpers"
```

---

### Task 4: Export `scrapeRedfinValue` from the scraper

**Files:**
- Modify: `src/lib/scraper.ts`

**Interfaces:**
- Produces: `export async function scrapeRedfinValue(address: string): Promise<{ redfin_value?: number; redfin_url?: string }>` — the existing internal function, now exported (and returning the matched Redfin URL when found). Used by the scan route for cheap, OpenAI-free enrichment.

- [ ] **Step 1: Export the function**

In `src/lib/scraper.ts`, change the internal `scrapeRedfinValue` declaration to `export async function scrapeRedfinValue(...)`. If it does not already capture the Redfin URL, add `redfin_url` to its return object (the function already locates a `redfin.com/.../home/<id>` URL before fetching — return that URL alongside `redfin_value`). Do not change any existing callers or the OpenAI Zillow/county paths.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraper.ts
git commit -m "feat(jv): export scrapeRedfinValue for cheap JV enrichment"
```

---

### Task 5: JV server actions (list, triage, restore, manual-add, events)

**Files:**
- Create: `src/actions/jv-deals.ts`

**Interfaces:**
- Consumes: `JvDeal`, `JvDealEvent` (Task 2), `manualJvDealSchema` (Task 2), `normalizeAddress` (Task 3), `scrapeRedfinValue` (Task 4), `requireAdmin`/`getAuthUser` (`src/lib/auth.ts`), `createServerClient` (`src/lib/supabase/server.ts`), `ActionResult` (`src/lib/types.ts`).
- Produces:
  - `listJvDeals(): Promise<ActionResult<{ active: JvDeal[]; archived: JvDeal[] }>>`
  - `setJvDealStatus(id: string, status: 'interested' | 'didnt_sell' | 'cleared' | 'new'): Promise<ActionResult<JvDeal>>` (writes a matching event; `cleared` archives)
  - `restoreJvDeal(id: string): Promise<ActionResult<JvDeal>>` (status → `new`, event `restored`)
  - `addManualJvDeal(input: unknown): Promise<ActionResult<JvDeal>>`
  - `listJvEvents(limit?: number): Promise<ActionResult<(JvDealEvent & { actor_name: string | null; deal_address: string | null })[]>>`
  - `getActiveNormalizedAddresses(): Promise<string[]>` (helper for the scan route; admin/service context)

- [ ] **Step 1: Implement the actions**

```ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import { manualJvDealSchema } from '@/lib/validations/jv'
import { normalizeAddress } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'
import type { ActionResult, JvDeal, JvDealEvent, JvDealStatus, JvDealEventType } from '@/lib/types'

const STATUS_EVENT: Record<string, JvDealEventType> = {
  interested: 'interested', didnt_sell: 'didnt_sell', cleared: 'cleared', new: 'restored',
}

export async function listJvDeals(): Promise<ActionResult<{ active: JvDeal[]; archived: JvDeal[] }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deals').select('*').order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    const all = (data ?? []) as JvDeal[]
    return {
      success: true,
      data: {
        active: all.filter((d) => d.status !== 'cleared'),
        archived: all.filter((d) => d.status === 'cleared'),
      },
    }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function setJvDealStatus(
  id: string, status: 'interested' | 'didnt_sell' | 'cleared' | 'new',
): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deals').update({ status: status as JvDealStatus }).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    await supabase.from('jv_deal_events').insert({
      jv_deal_id: id, event_type: STATUS_EVENT[status], actor_id: user.id,
    })
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function restoreJvDeal(id: string): Promise<ActionResult<JvDeal>> {
  return setJvDealStatus(id, 'new')
}

export async function addManualJvDeal(input: unknown): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const v = manualJvDealSchema.parse(input)
    const supabase = await createServerClient()

    // Dedupe against active JV deals only.
    const candidate = normalizeAddress(v.address)
    const { data: actives } = await supabase
      .from('jv_deals').select('address_normalized').neq('status', 'cleared')
    if ((actives ?? []).some((r) => r.address_normalized === candidate)) {
      return { success: false, error: 'That address is already in the JV inbox.' }
    }

    let redfin_price: number | null = null
    let redfin_url: string | null = null
    try {
      const r = await scrapeRedfinValue(v.address)
      redfin_price = r.redfin_value ?? null
      redfin_url = r.redfin_url ?? null
    } catch { /* best-effort */ }

    const { data, error } = await supabase.from('jv_deals').insert({
      source_channel: 'manual',
      source_name: v.source_name,
      address: v.address,
      address_normalized: candidate,
      asking_price: v.asking_price || null,
      note: v.note || null,
      redfin_price, redfin_url,
      status: 'new',
      created_by: user.id,
    }).select().single()
    if (error) return { success: false, error: error.message }
    await supabase.from('jv_deal_events').insert({
      jv_deal_id: data.id, event_type: 'received', actor_id: user.id,
      metadata: { channel: 'manual' },
    })
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function listJvEvents(
  limit = 200,
): Promise<ActionResult<(JvDealEvent & { actor_name: string | null; deal_address: string | null })[]>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deal_events')
      .select('*, actor:users!actor_id(name), deal:jv_deals!jv_deal_id(address)')
      .order('created_at', { ascending: false }).limit(limit)
    if (error) return { success: false, error: error.message }
    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as JvDealEvent),
      actor_name: (r.actor as { name?: string } | null)?.name ?? null,
      deal_address: (r.deal as { address?: string } | null)?.address ?? null,
    }))
    return { success: true, data: rows }
  } catch (e) { return { success: false, error: (e as Error).message } }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/actions/jv-deals.ts
git commit -m "feat(jv): server actions for list/triage/restore/manual-add/events"
```

---

### Task 6: JV deal card component

**Files:**
- Create: `src/components/JvDealCard.tsx`

**Interfaces:**
- Consumes: `JvDeal` (Task 2).
- Produces: `JvDealCard` (client) with props `{ deal: JvDeal; onInterested?: (id)=>void; onDidntSell?: (id)=>void; onClear?: (id)=>void; onRestore?: (id)=>void; archived?: boolean; badges?: { wasInterested: boolean; wasDidntSell: boolean }; pending?: boolean }`.

- [ ] **Step 1: Implement the card (match `DealsSentPanel.tsx` styling)**

Mirror the Deals-Sent row styling. State → left border + bg:
- `interested` → green: `border-l-4 border-[#42501f] bg-[#ebeee0] dark:bg-[#2a2f1c]`
- `didnt_sell` → orange: `border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-950/40`
- `new` → neutral: `border-l-4 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900`
- archived → muted neutral, no action buttons except Restore.

Row container: `flex items-center justify-between gap-3 rounded-md px-3 py-2.5`. Left block: address `text-sm font-semibold text-neutral-900 dark:text-neutral-100` + a row of meta `text-xs text-neutral-500 dark:text-neutral-400` showing `asking_price`, `Redfin ${redfin_price?.toLocaleString() ?? '—'}`, `source_name`, formatted `created_at`. If `needs_review`, show a `⚠︎ review` pill (`rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5`).

**Card click → source:** if `deal.source_url`, wrap clickable area in `<a href={deal.source_url} target="_blank" rel="noopener noreferrer">`. Else if `deal.note`, clicking toggles an inline note popover (local `useState` `showNote`). Else not clickable.

Right block: action buttons (only when not `archived`):
- Interested: `onInterested(deal.id)` — green check; Didn't Sell: `onDidntSell(deal.id)` — orange; Clear: `onClear(deal.id)`. Each `disabled={pending}`.
When `archived`: render badges (`was Interested` / `was Didn't Sell` pills from `badges`) + a **Restore** button calling `onRestore(deal.id)`.

Buttons styled like existing small pill buttons: `rounded border px-2 py-0.5 text-[0.6rem] font-medium` with appropriate color + `dark:` variants and a `title`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/JvDealCard.tsx
git commit -m "feat(jv): JvDealCard with green/orange/neutral + archive states"
```

---

### Task 7: JV page (server + client) with manual add + archive

**Files:**
- Create: `src/app/app/jvs/page.tsx`
- Create: `src/app/app/jvs/client.tsx`

**Interfaces:**
- Consumes: `listJvDeals`, `setJvDealStatus`, `restoreJvDeal`, `addManualJvDeal` (Task 5), `JvDealCard` (Task 6), `deriveArchiveBadges` + `listJvEvents` not needed here.
- Produces: the `/app/jvs` route.

- [ ] **Step 1: Server page (admin-gated, force-dynamic)**

```tsx
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { listJvDeals } from "@/actions/jv-deals";
import { JvInboxClient } from "./client";

export const dynamic = "force-dynamic";

export default async function JvsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/app");
  const result = await listJvDeals();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4 dark:border-neutral-700">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">JVs</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Inbound JV / wholesale deals</p>
        </div>
      </header>
      {result.success ? (
        <JvInboxClient initialActive={result.data.active} initialArchived={result.data.archived} />
      ) : (
        <p className="text-sm text-red-600">Error loading JV deals: {result.error}</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Client (`client.tsx`) — list, actions, manual-add, archive toggle**

Implement `JvInboxClient` (`"use client"`) with:
- `useState` for `active`, `archived`, `view` (`'active' | 'archive'`), `pendingId`, `showManual`, manual form fields, and per-deal event maps for badges (archived badges: fetch via a small `listJvEvents`-style call is overkill — instead derive badges from a `jv_deal_events` summary returned with archived deals; SIMPLER: compute badges client-side is impossible without events, so include badge booleans by having `listJvDeals` also return them). **Adjust:** in Task 5 `listJvDeals`, also fetch events for archived deals and attach `{ wasInterested, wasDidntSell }` using `deriveArchiveBadges`. (See Step 3.)
- Actions call `setJvDealStatus(id, 'interested'|'didnt_sell'|'cleared')` / `restoreJvDeal(id)`, set `pendingId` during the call, then move the deal between `active`/`archived` locally and `router.refresh()`.
- A **"+ Manual Add"** button toggles a small form (Address, Source, Asking price, Note) → calls `addManualJvDeal`, prepends the result to `active`, resets the form, shows the error string on failure.
- A view toggle: "Active (N)" / "Archive (M)". Active view renders `active` deals as `JvDealCard`; Archive view renders `archived` with `archived` + `badges`.
- Empty states: "No JV deals yet." / "Archive is empty."
- All wrapped in dashed-border cards consistent with the app; dark variants throughout.

- [ ] **Step 3: Extend `listJvDeals` to attach archive badges**

Update Task 5's `listJvDeals` so archived deals include badges: after fetching deals, fetch `jv_deal_events` for the archived ids (`select jv_deal_id,event_type ... in (...)`) and attach `{ wasInterested, wasDidntSell }` via `deriveArchiveBadges`. Return type becomes `{ active: JvDeal[]; archived: (JvDeal & { badges: { wasInterested: boolean; wasDidntSell: boolean } })[] }`. Update the type import in `client.tsx` accordingly.

- [ ] **Step 4: Build**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npm run build`
Expected: compiles; `/app/jvs` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/jvs/page.tsx src/app/app/jvs/client.tsx src/actions/jv-deals.ts
git commit -m "feat(jv): JVs inbox page with triage, manual-add, archive"
```

---

### Task 8: Nav item (admin-only) + Settings activity log

**Files:**
- Modify: `src/components/AppNavbar.tsx`
- Create: `src/app/app/settings/jv-activity-log.tsx`
- Modify: `src/app/app/settings/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`isAdmin`) in navbar; `listJvEvents` (Task 5) in the activity log.

- [ ] **Step 1: Add the "JVs" nav item (admin-only) after Dispositions**

In `AppNavbar.tsx`, add `{ label: "JVs", href: "/app/jvs", adminOnly: true }` to `PRIMARY_ITEMS` right after the Dispositions entry. Update the `visibleItems` slice indices (the `slice(0, 4)` / `slice(4)` that interleave `EXPANDED_ITEMS`) to `slice(0, 5)` / `slice(5)` so Outreach/Marketing ordering is preserved. Filter out `adminOnly` items when `!isAdmin` (read `isAdmin` from `useAuth()`); existing items without the flag are unaffected.

- [ ] **Step 2: Create `jv-activity-log.tsx` (client)**

A `"use client"` component that on mount calls `listJvEvents()` and renders a reverse-chron list: each row `{formatted time} · {event_type} · {deal_address ?? '—'} · {actor_name ?? 'system'}`. Small monospace-ish list, `text-xs`, dark variants, scrollable `max-h-80 overflow-y-auto`. Loading + empty + error states.

- [ ] **Step 3: Add the JV section to Settings**

In `src/app/app/settings/page.tsx`, add `<CollapsibleCard title="JV Activity Log"><JvActivityLog /></CollapsibleCard>` within the sections block, and import the component. (No extra fetch needed — the component self-fetches.)

- [ ] **Step 4: Build**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npm run build`
Expected: compiles; navbar shows "JVs" for admins.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppNavbar.tsx src/app/app/settings/jv-activity-log.tsx src/app/app/settings/page.tsx
git commit -m "feat(jv): admin nav item + Settings activity log"
```

> **Checkpoint:** Tasks 1–8 ship a fully usable, manually-driven JV inbox (add/triage/archive/restore + log). Deploy and let Randy use it while email intake (Tasks 9–11) is built. Tasks 9–11 need the Gmail app password in env before they run live.

---

### Task 9: Email extraction module (TDD on the parser)

**Files:**
- Create: `src/lib/jv/extract.ts`
- Test: `src/__tests__/lib/jv/extract.test.ts`

**Interfaces:**
- Produces:
  - `type ExtractedDeal = { address: string | null; asking_price: string | null; needs_review: boolean; extra?: Record<string, unknown> }`
  - `parseDealsJson(text: string): ExtractedDeal[]` — pure: parse the model's JSON output (tolerant of code fences / surrounding prose), return `[]` on garbage.
  - `extractDealsFromEmail(opts: { subject: string; from: string; body: string }): Promise<ExtractedDeal[]>` — calls Claude Haiku, returns 0..N deals; on model/parse failure returns `[]`.

- [ ] **Step 1: Write the failing test (pure parser only)**

```ts
import { describe, it, expect } from 'vitest'
import { parseDealsJson } from '@/lib/jv/extract'

describe('parseDealsJson', () => {
  it('parses a clean JSON array', () => {
    const out = parseDealsJson('[{"address":"1 A St","asking_price":"$100k","needs_review":false}]')
    expect(out).toEqual([{ address: '1 A St', asking_price: '$100k', needs_review: false }])
  })
  it('tolerates code fences and surrounding prose', () => {
    const out = parseDealsJson('Here you go:\n```json\n[{"address":"2 B Ave","asking_price":null,"needs_review":true}]\n```')
    expect(out[0].address).toBe('2 B Ave')
    expect(out[0].needs_review).toBe(true)
  })
  it('returns [] for non-deal / garbage', () => {
    expect(parseDealsJson('not a deal')).toEqual([])
    expect(parseDealsJson('[]')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/__tests__/lib/jv/extract.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/jv/extract.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'

const MODEL = 'claude-haiku-4-5-20251001'

export type ExtractedDeal = {
  address: string | null
  asking_price: string | null
  needs_review: boolean
  extra?: Record<string, unknown>
}

export function parseDealsJson(text: string): ExtractedDeal[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return []
    return arr
      .filter((d) => d && typeof d === 'object')
      .map((d) => ({
        address: typeof d.address === 'string' && d.address.trim() ? d.address.trim() : null,
        asking_price: typeof d.asking_price === 'string' && d.asking_price.trim() ? d.asking_price.trim() : null,
        needs_review: Boolean(d.needs_review),
        extra: d.extra && typeof d.extra === 'object' ? d.extra : undefined,
      }))
  } catch { return [] }
}

const PROMPT = (subject: string, from: string, body: string) => `You extract real-estate wholesale/JV deals from an email for an acquisitions company.

An email may contain ZERO deals (newsletters, replies, spam, scheduling) or one or MORE property deals.

Return ONLY a JSON array. One object per property deal:
[{"address": string|null, "asking_price": string|null, "needs_review": boolean}]

Rules:
- If the email clearly contains no property deal, return [].
- "address" = full street address if present (else null).
- "asking_price" = price as written (e.g. "$450,000", "450k"); null if absent.
- "needs_review" = true when it looks like a deal but the address or price is unclear/missing (we'd rather review than miss it).
- Do NOT invent data. No prose, no code fences — just the JSON array.

FROM: ${from}
SUBJECT: ${subject}
BODY:
${body.slice(0, 6000)}`

export async function extractDealsFromEmail(opts: {
  subject: string; from: string; body: string
}): Promise<ExtractedDeal[]> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT(opts.subject, opts.from, opts.body) }],
    })
    await logApiUsage({
      provider: 'anthropic', model: MODEL, feature: 'jv_extract',
      input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens,
    })
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n')
    return parseDealsJson(text)
  } catch { return [] }
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/__tests__/lib/jv/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jv/extract.ts src/__tests__/lib/jv/extract.test.ts
git commit -m "feat(jv): Claude email deal extraction + tolerant JSON parser"
```

---

### Task 10: IMAP fetch module

**Files:**
- Create: `src/lib/jv/imap.ts`

**Interfaces:**
- Consumes: env `JV_IMAP_USER`, `JV_IMAP_PASSWORD`, `JV_IMAP_HOST` (default `imap.gmail.com`).
- Produces:
  - `type JvMessage = { uid: number; messageId: string | null; from: string; subject: string; date: string; body: string }`
  - `fetchNewJvMessages(opts: { sinceUid: number; sinceDate: Date }): Promise<{ messages: JvMessage[]; maxUid: number }>` — connects, opens INBOX, fetches messages with `uid > sinceUid` AND internal date `>= sinceDate`, returns parsed messages (prefer text body; strip HTML if only HTML) and the highest UID seen.

- [ ] **Step 1: Implement `src/lib/jv/imap.ts`**

```ts
import { ImapFlow } from 'imapflow'

export type JvMessage = {
  uid: number
  messageId: string | null
  from: string
  subject: string
  date: string
  body: string
}

function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function fetchNewJvMessages(opts: { sinceUid: number; sinceDate: Date }): Promise<{
  messages: JvMessage[]; maxUid: number
}> {
  const client = new ImapFlow({
    host: process.env.JV_IMAP_HOST || 'imap.gmail.com',
    port: 993, secure: true,
    auth: { user: process.env.JV_IMAP_USER || '', pass: process.env.JV_IMAP_PASSWORD || '' },
    logger: false,
  })
  const messages: JvMessage[] = []
  let maxUid = opts.sinceUid
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      // UID range from sinceUid+1 upward; also gate by internal date.
      const range = `${opts.sinceUid + 1}:*`
      for await (const msg of client.fetch(
        { uid: range }, { uid: true, envelope: true, internalDate: true, source: true },
      )) {
        if (msg.uid <= opts.sinceUid) continue
        if (msg.internalDate && msg.internalDate < opts.sinceDate) { maxUid = Math.max(maxUid, msg.uid); continue }
        const { simpleParser } = await import('mailparser')
        const parsed = await simpleParser(msg.source as Buffer)
        const body = (parsed.text && parsed.text.trim())
          ? parsed.text
          : (parsed.html ? htmlToText(parsed.html) : '')
        messages.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? msg.envelope?.messageId ?? null,
          from: parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? 'unknown',
          subject: parsed.subject ?? msg.envelope?.subject ?? '(no subject)',
          date: (msg.internalDate ?? new Date()).toISOString(),
          body,
        })
        maxUid = Math.max(maxUid, msg.uid)
      }
    } finally { lock.release() }
  } finally { await client.logout() }
  return { messages, maxUid }
}
```

Note: `mailparser` is a transitive dep of `imapflow`'s ecosystem but may need adding. If `npm ls mailparser` shows it absent, add it: `npm install mailparser` and commit the lockfile.

- [ ] **Step 2: Verify dependency + typecheck**

Run: `npm ls mailparser || npm install mailparser` then `npx tsc --noEmit`
Expected: tsc exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jv/imap.ts package.json package-lock.json
git commit -m "feat(jv): Gmail IMAP fetch of new JV messages"
```

---

### Task 11: Scan cron route + wiring

**Files:**
- Create: `src/app/api/jv/scan/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `fetchNewJvMessages` (Task 10), `extractDealsFromEmail` (Task 9), `normalizeAddress` (Task 3), `scrapeRedfinValue` (Task 4), `getAppSetting`/`updateAppSetting` (`src/actions/app-settings.ts`), `createAdminClient` (`src/lib/supabase/admin.ts`), env `CRON_SECRET`.
- App-settings keys used: `jv_intake_enabled` (`"true"`/`"false"`), `jv_last_uid` (int string), `jv_start_cutoff` (ISO date).

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSetting, updateAppSetting } from '@/actions/app-settings'
import { fetchNewJvMessages } from '@/lib/jv/imap'
import { extractDealsFromEmail } from '@/lib/jv/extract'
import { normalizeAddress } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'

export const maxDuration = 300

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const enabled = (await getAppSetting('jv_intake_enabled')).data
  if (enabled === 'false') return NextResponse.json({ ok: true, skipped: 'disabled' })

  const supabase = createAdminClient()
  const sinceUid = parseInt((await getAppSetting('jv_last_uid')).data || '0', 10) || 0
  const cutoffStr = (await getAppSetting('jv_start_cutoff')).data
  const sinceDate = cutoffStr ? new Date(cutoffStr) : new Date(Date.now() - 7 * 864e5)

  let created = 0, skipped = 0
  try {
    const { messages, maxUid } = await fetchNewJvMessages({ sinceUid, sinceDate })

    const { data: actives } = await supabase
      .from('jv_deals').select('address_normalized').neq('status', 'cleared')
    const activeNorm = new Set((actives ?? []).map((r) => r.address_normalized).filter(Boolean))

    for (const m of messages) {
      const deals = await extractDealsFromEmail({ subject: m.subject, from: m.from, body: m.body })
      for (const d of deals) {
        const norm = normalizeAddress(d.address)
        if (norm && activeNorm.has(norm)) { skipped++; continue }

        let redfin_price: number | null = null, redfin_url: string | null = null
        if (d.address) {
          try { const r = await scrapeRedfinValue(d.address); redfin_price = r.redfin_value ?? null; redfin_url = r.redfin_url ?? null } catch {}
        }
        const sourceUrl = m.messageId
          ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(m.messageId)}`
          : null

        const { data: inserted, error } = await supabase.from('jv_deals').insert({
          source_channel: 'email', source_name: m.from, source_url: sourceUrl, source_ref: m.messageId,
          address: d.address, address_normalized: norm || null, asking_price: d.asking_price,
          redfin_price, redfin_url, raw_excerpt: m.body.slice(0, 2000),
          status: 'new', needs_review: d.needs_review, extra: d.extra ?? null,
        }).select('id').single()

        if (error) { skipped++; continue }            // unique source_ref collision => already ingested
        await supabase.from('jv_deal_events').insert({ jv_deal_id: inserted.id, event_type: 'received', metadata: { channel: 'email' } })
        if (norm) activeNorm.add(norm)
        created++
      }
    }
    if (maxUid > sinceUid) await updateAppSetting('jv_last_uid', String(maxUid))
    return NextResponse.json({ ok: true, processed: messages.length, created, skipped })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
```

Note: `updateAppSetting` is admin-gated via `getAuthUser`; in the cron context there's no user. Add a service-mode path: either (a) write `jv_last_uid` directly with the admin client here instead of `updateAppSetting`, or (b) add a non-gated internal setter. **Use (a):** `await supabase.from('app_settings').upsert({ key: 'jv_last_uid', value: String(maxUid) }, { onConflict: 'key' })`. Read via direct admin select too, to avoid the auth-gated `getAppSetting` in cron. Replace the `getAppSetting` reads with direct `supabase.from('app_settings').select('value').eq('key', ...).maybeSingle()`.

- [ ] **Step 2: Add the cron to `vercel.json`**

```json
{ "crons": [
  { "path": "/api/news/refresh", "schedule": "0 15 * * *" },
  { "path": "/api/jv/scan", "schedule": "*/10 * * * *" }
] }
```

- [ ] **Step 3: Build**

Run: `NODE_OPTIONS="--max-old-space-size=8192" npm run build`
Expected: compiles; `/api/jv/scan` in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jv/scan/route.ts vercel.json
git commit -m "feat(jv): scan cron — IMAP -> extract -> dedupe -> enrich -> insert"
```

---

### Task 12: Go-live config (manual, needs Randy)

Not code — record the runtime setup:
- [ ] Randy enables IMAP on the JV Gmail and generates an **app password**.
- [ ] Add Vercel env vars: `JV_IMAP_USER` (the JV Gmail address), `JV_IMAP_PASSWORD` (app password), and confirm `CRON_SECRET` exists.
- [ ] Seed app settings (via Supabase MCP `execute_sql`): `jv_intake_enabled='true'`, `jv_start_cutoff='<today ISO>'`, `jv_last_uid='0'`.
- [ ] Trigger one manual run (`GET /api/jv/scan` with the cron Bearer) and confirm cards appear; tune the extraction prompt against real inbox samples if needed.

---

## Self-review notes

- **Spec coverage:** inbox cards + 3 actions (T6/T7), manual add (T5/T7), archive + restore + badges (T5/T6/T7), card-click-to-source/note (T6), email intake via existing JV Gmail (T9–T11), dedupe vs active JV only (T5/T11), default-to-inclusion `needs_review` (T9/T11), Redfin enrichment without OpenAI cost (T4), activity log in Settings (T8), nav after Dispositions admin-only (T8), cost controls (Haiku + free scrape + idle-free polling). All covered.
- **Type consistency:** `setJvDealStatus` is the single status mutator (events derived via `STATUS_EVENT`); `restoreJvDeal` delegates to it; `scrapeRedfinValue` returns `{ redfin_value?, redfin_url? }` used identically in T5 and T11; `JvDeal`/`JvDealEvent` shared from `types.ts`.
- **Known follow-up baked in:** T7 Step 3 amends T5's `listJvDeals` return to include archived badges — implement T5 first, then apply the T7-Step-3 amendment when building the page.
