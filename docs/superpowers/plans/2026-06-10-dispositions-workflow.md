# Dispositions Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual dispositions process with a structured workflow that suggests matching investors per deal, lets Randy track sends via checkboxes, and auto-populates each investor's deal-sent history.

**Architecture:** Three coordinated changes ship together. (A) Structured locations: new `locations` catalog table with parent/child hierarchy; reshape existing `investor_locations` join to use `location_id` FK; new `listing_page_locations` join. (B) Find-Investors flow: new `deal_sends` table + "Find Investors (N)" button + modal popup with checkbox tracking. (C) Investor record's "Deals Sent" panel auto-populates from `deal_sends` instead of free text.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase Postgres, Zod v4, Vitest. Server Actions return `ActionResult<T>`. All UI components ship with `dark:` Tailwind variants.

---

## Critical Context for Implementers

**The existing `investor_locations` table is NOT empty.** Migration `016_investor_locations.sql` already created `investor_locations(id, investor_id, location_name TEXT, created_at)` as a flat chip system. Migration 059 below reshapes it to add `location_id` FK while keeping `location_name` for one release as fallback. Don't drop `location_name` yet.

**Existing chip picker on the investor record auto-runs.** `src/app/app/dispositions/investor-record/[id]/client.tsx` lines 64–88 split `locations_of_interest` into chip rows on view. This auto-migration must be removed once the new picker lands (Task 12) — otherwise it will create dangling rows with no `location_id`.

**Existing `addInvestorLocation` / `removeInvestorLocation` actions take name strings.** Their signatures change in Task 7. All call sites must update at the same commit.

**Project conventions to follow:**
- Server actions in `src/actions/` use `ActionResult<T>` discriminated union from `src/lib/types.ts`
- Auth via `requireAuth(user)` / `requireAdmin(user)` from `src/lib/auth.ts`
- Validations in `src/lib/validations/` use Zod v4 (`z.object`, `z.enum`)
- Tests live in `src/__tests__/<area>/<name>.test.ts` mirroring source layout
- Tailwind uses dashed-border design system; dark mode is mandatory
- Plum brand color is `#5D3954`; olive accent is `#585732` / `#ebeee0`
- Component file naming: PascalCase for exports, kebab-case for routes

**Run before each commit:** `npm run lint` and `npm run test` (must both pass before committing).

---

## File Structure

### New files

- `supabase/migrations/058_locations_catalog.sql` — creates `locations` table + seed
- `supabase/migrations/059_investor_locations_link.sql` — adds `location_id` FK to existing table, backfills
- `supabase/migrations/060_deal_sends.sql` — creates `listing_page_locations` + `deal_sends`
- `src/lib/validations/locations.ts` — Zod schemas
- `src/actions/locations.ts` — server actions for location CRUD + listing-page links
- `src/actions/deal-sends.ts` — matching, ticking, counts
- `src/components/LocationChipPicker.tsx` — typeahead + chip UI
- `src/components/FindInvestorsDialog.tsx` — popup modal
- `src/components/DealsSentPanel.tsx` — auto-populated panel
- `src/app/app/dispositions/migrate-locations/page.tsx` — server component
- `src/app/app/dispositions/migrate-locations/client.tsx` — client UI
- `src/__tests__/lib/validations/locations.test.ts`
- `src/__tests__/actions/locations.test.ts`
- `src/__tests__/actions/deal-sends-matching.test.ts`

### Modified files

- `src/lib/types.ts` — replace `InvestorLocation` shape; add `Location`, `DealSend`, `ListingPageLocation`
- `src/lib/validations/investors.ts` — make `locations_of_interest` fully optional
- `src/actions/investors.ts` — update `addInvestorLocation` / `removeInvestorLocation` signatures; drop the `syncLocationsText` denormalizer
- `src/actions/listing-pages.ts` — `createListingPage` auto-links to matching `locations` row by city
- `src/app/app/dispositions/investor-record/[id]/client.tsx` — replace inline chip picker with `<LocationChipPicker>`; replace free-text Deals Sent with `<DealsSentPanel>`; remove the auto-migrate effect
- `src/components/InvestorForm.tsx` — replace `<textarea>` for `locations_of_interest` with `<LocationChipPicker>`
- `src/app/app/marketing-page-creator/client.tsx` — add "Find Investors (N)" button per row; add 7th grid column
- `src/app/app/marketing-page-creator/page.tsx` — fetch per-page match counts
- `src/app/app/marketing-page-creator/edit/[id]/page.tsx` (+ its client) — add locations chip section
- `src/components/VersionLabel.tsx` — bump to 4.23.0

---

## Phase 1 — Database

### Task 1: Locations catalog migration

**Files:**
- Create: `supabase/migrations/058_locations_catalog.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Structured location catalog with parent/child hierarchy
-- Replaces free-text locations_of_interest matching with queryable joins
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('city', 'county', 'region', 'state', 'neighborhood')),
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  state_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX locations_parent_id_idx ON locations(parent_id);
CREATE INDEX locations_name_idx ON locations(lower(name));
CREATE UNIQUE INDEX locations_name_kind_state_idx
  ON locations(lower(name), kind, COALESCE(state_code, ''));

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read locations"
  ON locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert locations"
  ON locations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Seed: region → state → county → cities
DO $$
DECLARE
  region_pnw UUID;
  state_wa UUID;
  state_or UUID;
  state_id_state UUID;
  county_king UUID;
  county_pierce UUID;
  county_snohomish UUID;
BEGIN
  INSERT INTO locations (name, kind, state_code) VALUES ('Pacific Northwest', 'region', NULL)
    RETURNING id INTO region_pnw;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Washington', 'state', region_pnw, 'WA')
    RETURNING id INTO state_wa;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Oregon', 'state', region_pnw, 'OR')
    RETURNING id INTO state_or;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Idaho', 'state', region_pnw, 'ID')
    RETURNING id INTO state_id_state;

  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('King County', 'county', state_wa, 'WA')
    RETURNING id INTO county_king;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Pierce County', 'county', state_wa, 'WA')
    RETURNING id INTO county_pierce;
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES ('Snohomish County', 'county', state_wa, 'WA')
    RETURNING id INTO county_snohomish;

  -- King County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Seattle', 'city', county_king, 'WA'),
    ('Bellevue', 'city', county_king, 'WA'),
    ('Renton', 'city', county_king, 'WA'),
    ('Kirkland', 'city', county_king, 'WA'),
    ('Sammamish', 'city', county_king, 'WA'),
    ('Issaquah', 'city', county_king, 'WA'),
    ('Redmond', 'city', county_king, 'WA'),
    ('Mercer Island', 'city', county_king, 'WA'),
    ('Burien', 'city', county_king, 'WA'),
    ('Tukwila', 'city', county_king, 'WA'),
    ('Des Moines', 'city', county_king, 'WA'),
    ('Kent', 'city', county_king, 'WA'),
    ('Auburn', 'city', county_king, 'WA'),
    ('Federal Way', 'city', county_king, 'WA'),
    ('SeaTac', 'city', county_king, 'WA'),
    ('Shoreline', 'city', county_king, 'WA');

  -- Pierce County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Tacoma', 'city', county_pierce, 'WA'),
    ('Lakewood', 'city', county_pierce, 'WA'),
    ('Puyallup', 'city', county_pierce, 'WA'),
    ('University Place', 'city', county_pierce, 'WA');

  -- Snohomish County cities
  INSERT INTO locations (name, kind, parent_id, state_code) VALUES
    ('Everett', 'city', county_snohomish, 'WA'),
    ('Lynnwood', 'city', county_snohomish, 'WA'),
    ('Edmonds', 'city', county_snohomish, 'WA'),
    ('Bothell', 'city', county_snohomish, 'WA'),
    ('Mill Creek', 'city', county_snohomish, 'WA'),
    ('Mukilteo', 'city', county_snohomish, 'WA');
END $$;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with `name: "058_locations_catalog"` and the SQL above.

Expected: tool returns success. Tables and seed rows visible via subsequent `list_tables` / `execute_sql` checks.

- [ ] **Step 3: Verify seed data**

Run via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
SELECT kind, COUNT(*) FROM locations GROUP BY kind ORDER BY kind;
```
Expected: city=26, county=3, region=1, state=3 (totals: 33 rows).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/058_locations_catalog.sql
git commit -m "feat(db): add locations catalog with parent/child hierarchy and seed data"
```

---

### Task 2: Investor locations FK migration

**Files:**
- Create: `supabase/migrations/059_investor_locations_link.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Reshape investor_locations to reference the new locations catalog
-- Existing location_name column is kept for one release as fallback;
-- it will be dropped in a follow-up migration once UI is stable.
ALTER TABLE investor_locations
  ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

CREATE INDEX investor_locations_location_id_idx ON investor_locations(location_id);

-- Best-effort backfill: match existing location_name strings against locations.name
-- Case-insensitive, picks first match. Unmatched rows are left with location_id IS NULL
-- and will be cleaned up via the migration UI.
UPDATE investor_locations il
SET location_id = l.id
FROM locations l
WHERE l.id = (
  SELECT id FROM locations
  WHERE lower(name) = lower(trim(il.location_name))
  ORDER BY
    CASE kind
      WHEN 'city' THEN 1
      WHEN 'neighborhood' THEN 2
      WHEN 'county' THEN 3
      WHEN 'region' THEN 4
      WHEN 'state' THEN 5
    END
  LIMIT 1
);

-- Prevent duplicate (investor, location) pairs
CREATE UNIQUE INDEX investor_locations_investor_location_unique_idx
  ON investor_locations(investor_id, location_id)
  WHERE location_id IS NOT NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Apply with `name: "059_investor_locations_link"`.

- [ ] **Step 3: Verify backfill rate**

Run:
```sql
SELECT
  COUNT(*) FILTER (WHERE location_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE location_id IS NULL) AS unlinked,
  COUNT(*) AS total
FROM investor_locations;
```
Expected: most rows have `location_id` populated. Unlinked rows are migration UI's job.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/059_investor_locations_link.sql
git commit -m "feat(db): link investor_locations to catalog via location_id FK"
```

---

### Task 3: Listing page locations and deal sends migration

**Files:**
- Create: `supabase/migrations/060_deal_sends.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Many-to-many: each deal can cover one or more locations
CREATE TABLE listing_page_locations (
  listing_page_id UUID NOT NULL REFERENCES listing_pages(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_page_id, location_id)
);

CREATE INDEX listing_page_locations_location_id_idx ON listing_page_locations(location_id);

ALTER TABLE listing_page_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read listing_page_locations"
  ON listing_page_locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage listing_page_locations"
  ON listing_page_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tracks which deals have been sent to which investors
CREATE TABLE deal_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_page_id UUID NOT NULL REFERENCES listing_pages(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID NOT NULL REFERENCES users(id),
  UNIQUE (listing_page_id, investor_id)
);

CREATE INDEX deal_sends_listing_page_id_idx ON deal_sends(listing_page_id);
CREATE INDEX deal_sends_investor_id_idx ON deal_sends(investor_id);

ALTER TABLE deal_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read deal_sends"
  ON deal_sends FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage deal_sends"
  ON deal_sends FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hierarchy-aware match function: returns all investors interested in a deal's
-- direct locations OR any ancestor (county, state, region) of those locations.
CREATE OR REPLACE FUNCTION matching_investors_for_listing_page(p_listing_page_id UUID)
RETURNS TABLE (
  investor_id UUID,
  match_location_id UUID,
  match_location_name TEXT,
  match_location_kind TEXT
)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE deal_location_tree AS (
    SELECT location_id
    FROM listing_page_locations
    WHERE listing_page_id = p_listing_page_id

    UNION

    SELECT l.parent_id
    FROM locations l
    JOIN deal_location_tree dlt ON l.id = dlt.location_id
    WHERE l.parent_id IS NOT NULL
  )
  SELECT DISTINCT ON (i.id)
    i.id,
    il.location_id,
    l.name,
    l.kind
  FROM investors i
  JOIN investor_locations il ON il.investor_id = i.id
  JOIN locations l ON l.id = il.location_id
  WHERE il.location_id IN (SELECT location_id FROM deal_location_tree WHERE location_id IS NOT NULL)
    AND i.status = 'active'
  ORDER BY
    i.id,
    CASE l.kind WHEN 'city' THEN 1 WHEN 'neighborhood' THEN 2 WHEN 'county' THEN 3 WHEN 'state' THEN 4 WHEN 'region' THEN 5 ELSE 6 END;
$$;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Apply with `name: "060_deal_sends"`.

- [ ] **Step 3: Verify the matching function**

Run a smoke test against a known seed:
```sql
-- Create a temporary listing page link to Sammamish (King County, WA, PNW)
-- and verify ancestor matching works. Use a real listing page id from your data.
SELECT * FROM matching_investors_for_listing_page('<pick a real listing_pages.id>') LIMIT 5;
```
Expected: function executes without error. May return zero rows until listing_page_locations are populated — that's fine for now.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/060_deal_sends.sql
git commit -m "feat(db): add listing_page_locations + deal_sends with hierarchy-aware matching"
```

---

## Phase 2 — Types and validations

### Task 4: Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Replace InvestorLocation and add new types**

Find the existing `InvestorLocation` type in `src/lib/types.ts` and replace it. Add the new types after it.

```typescript
export type LocationKind = 'city' | 'county' | 'region' | 'state' | 'neighborhood'

export type Location = {
  id: string
  name: string
  kind: LocationKind
  parent_id: string | null
  state_code: string | null
  created_at: string
  created_by: string | null
}

export type InvestorLocation = {
  investor_id: string
  location_id: string | null
  location_name: string | null  // legacy column, removed in a follow-up migration
  created_at: string
  // Joined fields (when fetched with location detail)
  location?: Location | null
}

export type ListingPageLocation = {
  listing_page_id: string
  location_id: string
  location?: Location | null
}

export type DealSend = {
  id: string
  listing_page_id: string
  investor_id: string
  sent_at: string
  sent_by: string
}

export type MatchingInvestor = {
  investor_id: string
  match_location_id: string
  match_location_name: string
  match_location_kind: LocationKind
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint
```
Expected: no new type errors. Existing call sites using `InvestorLocation.id` will fail — fix in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "types: add Location, ListingPageLocation, DealSend, MatchingInvestor"
```

---

### Task 5: Location Zod schemas

**Files:**
- Create: `src/lib/validations/locations.ts`
- Create: `src/__tests__/lib/validations/locations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/validations/locations.test.ts
import { describe, it, expect } from 'vitest'
import { createLocationSchema } from '@/lib/validations/locations'

describe('createLocationSchema', () => {
  it('accepts a valid city with parent', () => {
    const result = createLocationSchema.safeParse({
      name: 'Bellevue',
      kind: 'city',
      parent_id: '11111111-1111-1111-1111-111111111111',
      state_code: 'WA',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a region with no parent and no state', () => {
    const result = createLocationSchema.safeParse({
      name: 'Pacific Northwest',
      kind: 'region',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createLocationSchema.safeParse({
      name: '   ',
      kind: 'city',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown kind', () => {
    const result = createLocationSchema.safeParse({
      name: 'Bellevue',
      kind: 'town',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- locations.test.ts
```
Expected: FAIL with `Cannot find module '@/lib/validations/locations'`.

- [ ] **Step 3: Write the validation schema**

```typescript
// src/lib/validations/locations.ts
import { z } from 'zod'

export const locationKindSchema = z.enum(['city', 'county', 'region', 'state', 'neighborhood'])

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  kind: locationKindSchema,
  parent_id: z.string().uuid().nullable().optional(),
  state_code: z.string().length(2).nullable().optional(),
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- locations.test.ts
```
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/locations.ts src/__tests__/lib/validations/locations.test.ts
git commit -m "feat(validations): add createLocationSchema with kind enum"
```

---

## Phase 3 — Server actions

### Task 6: Location search and create actions

**Files:**
- Create: `src/actions/locations.ts`
- Create: `src/__tests__/actions/locations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/actions/locations.test.ts
import { describe, it, expect } from 'vitest'
import { createLocationSchema } from '@/lib/validations/locations'

describe('locations actions', () => {
  it('createLocationSchema validates input shape used by createLocation', () => {
    // The action delegates to createLocationSchema before insert. Sanity check.
    const valid = createLocationSchema.safeParse({ name: 'Olympia', kind: 'city', state_code: 'WA' })
    expect(valid.success).toBe(true)

    const invalid = createLocationSchema.safeParse({ name: '', kind: 'city' })
    expect(invalid.success).toBe(false)
  })
})
```

This is a thin schema-coupling test — the actions hit Supabase, which we test by hand at the end. Following the existing test pattern in `src/__tests__/actions/listing-pages-update.test.ts` which similarly validates input shapes.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- locations.test.ts
```
Expected: FAIL — locations actions file doesn't import.

- [ ] **Step 3: Write the actions file**

```typescript
// src/actions/locations.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createLocationSchema } from '@/lib/validations/locations'
import type { ActionResult, Location } from '@/lib/types'

export async function searchLocations(query: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const q = query.trim()
    const supabase = await createServerClient()
    let req = supabase.from('locations').select('*')
    if (q.length > 0) {
      req = req.ilike('name', `%${q}%`)
    }
    const { data, error } = await req
      .order('kind', { ascending: true })
      .order('name', { ascending: true })
      .limit(8)

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as Location[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createLocation(input: unknown): Promise<ActionResult<Location>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createLocationSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: validated.name,
        kind: validated.kind,
        parent_id: validated.parent_id ?? null,
        state_code: validated.state_code ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { success: false, error: 'A location with this name and kind already exists' }
      return { success: false, error: error.message }
    }
    return { success: true, data: data as Location }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLocationsForInvestor(investorId: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investor_locations')
      .select('location:locations(*)')
      .eq('investor_id', investorId)
      .not('location_id', 'is', null)

    if (error) return { success: false, error: error.message }
    const locs = (data ?? [])
      .map((r: { location: Location | null }) => r.location)
      .filter((l): l is Location => l !== null)
    return { success: true, data: locs }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLocationsForListingPage(listingPageId: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_page_locations')
      .select('location:locations(*)')
      .eq('listing_page_id', listingPageId)

    if (error) return { success: false, error: error.message }
    const locs = (data ?? [])
      .map((r: { location: Location | null }) => r.location)
      .filter((l): l is Location => l !== null)
    return { success: true, data: locs }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setListingPageLocations(
  listingPageId: string,
  locationIds: string[]
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error: delErr } = await supabase
      .from('listing_page_locations')
      .delete()
      .eq('listing_page_id', listingPageId)
    if (delErr) return { success: false, error: delErr.message }

    if (locationIds.length === 0) return { success: true, data: null }

    const rows = locationIds.map((location_id) => ({ listing_page_id: listingPageId, location_id }))
    const { error: insErr } = await supabase.from('listing_page_locations').insert(rows)
    if (insErr) return { success: false, error: insErr.message }

    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- locations.test.ts
```
Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/locations.ts src/__tests__/actions/locations.test.ts
git commit -m "feat(actions): add location search/create/link server actions"
```

---

### Task 7: Update investor location actions to use FK

**Files:**
- Modify: `src/actions/investors.ts`

- [ ] **Step 1: Replace addInvestorLocation, removeInvestorLocation, and drop syncLocationsText**

Find the section starting at `async function syncLocationsText` (~line 292) and ending after `removeInvestorLocation` (~line 352). Replace the whole section with:

```typescript
export async function addInvestorLocation(
  investorId: string,
  locationId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('investor_locations')
      .insert({ investor_id: investorId, location_id: locationId })

    if (error) {
      if (error.code === '23505') return { success: false, error: 'Location already added' }
      return { success: false, error: error.message }
    }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeInvestorLocation(
  investorId: string,
  locationId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('investor_locations')
      .delete()
      .eq('investor_id', investorId)
      .eq('location_id', locationId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Update the getInvestor select to join the location detail**

Find the `locationsRes` line (~line 56) and replace it:

```typescript
      supabase
        .from('investor_locations')
        .select('investor_id, location_id, location_name, created_at, location:locations(*)')
        .eq('investor_id', id)
        .order('created_at'),
```

- [ ] **Step 3: Drop the auto-insert-from-text in createInvestor**

Find the block in `createInvestor` (~lines 105–120) that splits `locations_of_interest` and inserts into `investor_locations`. Remove it entirely — new investors get locations via the picker after creation, not from the legacy text field.

Replace the block (which starts with `// Insert locations from the locations_of_interest text` and ends at the matching closing brace) with a single line:

```typescript
    // Locations are added separately via the LocationChipPicker after creation.
```

- [ ] **Step 4: Verify TypeScript and lint pass**

```bash
npm run lint
```
Expected: passes. If a call site in `investor-record/[id]/client.tsx` references the old signatures, it'll be fixed in Task 12 — for now lint will tolerate the old code since it still typechecks (string args still match).

- [ ] **Step 5: Commit**

```bash
git add src/actions/investors.ts
git commit -m "feat(actions): switch investor_locations actions to FK + drop text denormalizer"
```

---

### Task 8: Matching server action

**Files:**
- Create: `src/actions/deal-sends.ts`
- Create: `src/__tests__/actions/deal-sends-matching.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/actions/deal-sends-matching.test.ts
import { describe, it, expect } from 'vitest'

describe('deal-sends actions module', () => {
  it('exports the expected server actions', async () => {
    const mod = await import('@/actions/deal-sends')
    expect(typeof mod.getMatchingInvestors).toBe('function')
    expect(typeof mod.markSent).toBe('function')
    expect(typeof mod.unmarkSent).toBe('function')
    expect(typeof mod.getDealsSentForInvestor).toBe('function')
    expect(typeof mod.getMatchCountsForListingPages).toBe('function')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- deal-sends
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the actions file**

```typescript
// src/actions/deal-sends.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import type { ActionResult, Investor, ListingPage } from '@/lib/types'

export type MatchingInvestorRow = {
  investor: Pick<Investor, 'id' | 'name' | 'company'>
  location_interests: Array<{ id: string; name: string; kind: string }>
  match_location_name: string | null
  match_location_kind: string | null
  is_match: boolean
  sent_at: string | null
}

export async function getMatchingInvestors(
  listingPageId: string,
  opts: { showAll?: boolean } = {}
): Promise<ActionResult<MatchingInvestorRow[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // 1. Hierarchy-aware matches via the RPC function
    const { data: matchRows, error: matchErr } = await supabase
      .rpc('matching_investors_for_listing_page', { p_listing_page_id: listingPageId })

    if (matchErr) return { success: false, error: matchErr.message }

    const matches = new Map<string, { name: string; kind: string }>()
    for (const row of (matchRows ?? []) as Array<{ investor_id: string; match_location_name: string; match_location_kind: string }>) {
      if (!matches.has(row.investor_id)) {
        matches.set(row.investor_id, { name: row.match_location_name, kind: row.match_location_kind })
      }
    }

    // 2. Pull investor rows. If showAll, get every active investor; otherwise only matches.
    let investorQuery = supabase
      .from('investors')
      .select('id, name, company, investor_locations(location:locations(id, name, kind))')
      .eq('status', 'active')

    if (!opts.showAll) {
      const matchedIds = Array.from(matches.keys())
      if (matchedIds.length === 0) {
        return { success: true, data: [] }
      }
      investorQuery = investorQuery.in('id', matchedIds)
    }

    const { data: investors, error: invErr } = await investorQuery.order('name', { ascending: true })
    if (invErr) return { success: false, error: invErr.message }

    // 3. Pull sent state for these investors against this listing page
    const investorIds = (investors ?? []).map((i: { id: string }) => i.id)
    const { data: sends, error: sendsErr } = investorIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('deal_sends')
          .select('investor_id, sent_at')
          .eq('listing_page_id', listingPageId)
          .in('investor_id', investorIds)
    if (sendsErr) return { success: false, error: sendsErr.message }

    const sentMap = new Map<string, string>()
    for (const s of (sends ?? []) as Array<{ investor_id: string; sent_at: string }>) {
      sentMap.set(s.investor_id, s.sent_at)
    }

    // 4. Assemble rows
    const rows: MatchingInvestorRow[] = (investors ?? []).map((inv: {
      id: string
      name: string
      company: string | null
      investor_locations: Array<{ location: { id: string; name: string; kind: string } | null }>
    }) => {
      const match = matches.get(inv.id)
      const interests = (inv.investor_locations ?? [])
        .map((il) => il.location)
        .filter((l): l is { id: string; name: string; kind: string } => l !== null)
      return {
        investor: { id: inv.id, name: inv.name, company: inv.company },
        location_interests: interests,
        match_location_name: match?.name ?? null,
        match_location_kind: match?.kind ?? null,
        is_match: !!match,
        sent_at: sentMap.get(inv.id) ?? null,
      }
    })

    return { success: true, data: rows }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function markSent(
  listingPageId: string,
  investorId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('deal_sends')
      .insert({ listing_page_id: listingPageId, investor_id: investorId, sent_by: user.id })

    if (error) {
      if (error.code === '23505') return { success: true, data: null } // already marked
      return { success: false, error: error.message }
    }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function unmarkSent(
  listingPageId: string,
  investorId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('deal_sends')
      .delete()
      .eq('listing_page_id', listingPageId)
      .eq('investor_id', investorId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export type DealSentRow = {
  send_id: string
  listing_page_id: string
  address: string
  price: string
  city: string
  sent_at: string
}

export async function getDealsSentForInvestor(
  investorId: string
): Promise<ActionResult<DealSentRow[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('deal_sends')
      .select('id, listing_page_id, sent_at, listing_page:listing_pages(address, price, city)')
      .eq('investor_id', investorId)
      .order('sent_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const rows: DealSentRow[] = (data ?? []).map((r: {
      id: string
      listing_page_id: string
      sent_at: string
      listing_page: { address: string; price: string; city: string } | null
    }) => ({
      send_id: r.id,
      listing_page_id: r.listing_page_id,
      address: r.listing_page?.address ?? '(deleted)',
      price: r.listing_page?.price ?? '',
      city: r.listing_page?.city ?? '',
      sent_at: r.sent_at,
    }))

    return { success: true, data: rows }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export type MatchCounts = { matching: number; sent: number }

export async function getMatchCountsForListingPages(
  listingPageIds: string[]
): Promise<ActionResult<Record<string, MatchCounts>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (listingPageIds.length === 0) return { success: true, data: {} }

    const supabase = await createServerClient()
    const result: Record<string, MatchCounts> = {}

    for (const id of listingPageIds) {
      const { data: matchRows } = await supabase
        .rpc('matching_investors_for_listing_page', { p_listing_page_id: id })
      const { data: sentRows } = await supabase
        .from('deal_sends')
        .select('investor_id')
        .eq('listing_page_id', id)

      const matchingIds = new Set((matchRows ?? []).map((r: { investor_id: string }) => r.investor_id))
      const sentIds = new Set((sentRows ?? []).map((r: { investor_id: string }) => r.investor_id))
      result[id] = { matching: matchingIds.size, sent: sentIds.size }
    }

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- deal-sends
```
Expected: 1/1 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions/deal-sends.ts src/__tests__/actions/deal-sends-matching.test.ts
git commit -m "feat(actions): add deal-sends matching, ticking, and count actions"
```

---

## Phase 4 — UI components

### Task 9: LocationChipPicker component

**Files:**
- Create: `src/components/LocationChipPicker.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/LocationChipPicker.tsx
"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { searchLocations, createLocation } from "@/actions/locations";
import { addInvestorLocation, removeInvestorLocation } from "@/actions/investors";
import type { Location, LocationKind } from "@/lib/types";

const KIND_STYLES: Record<LocationKind, { icon: string; bg: string; border: string; text: string; darkBg: string; darkText: string }> = {
  city: { icon: "📍", bg: "bg-[#ebeee0]", border: "border-[#c5cca8]", text: "text-[#3d4a1c]", darkBg: "dark:bg-[#2a2f1c]", darkText: "dark:text-[#dce5b8]" },
  neighborhood: { icon: "📍", bg: "bg-[#ebeee0]", border: "border-[#c5cca8]", text: "text-[#3d4a1c]", darkBg: "dark:bg-[#2a2f1c]", darkText: "dark:text-[#dce5b8]" },
  county: { icon: "🏛", bg: "bg-[#ddebe5]", border: "border-[#88b59f]", text: "text-[#1f4d3a]", darkBg: "dark:bg-[#1a2f25]", darkText: "dark:text-[#9ec8b6]" },
  region: { icon: "🌲", bg: "bg-[#e0e3eb]", border: "border-[#99a3c2]", text: "text-[#2a3458]", darkBg: "dark:bg-[#1c2240]", darkText: "dark:text-[#a3afd9]" },
  state: { icon: "🗺", bg: "bg-[#f0e3eb]", border: "border-[#c099a3]", text: "text-[#58342a]", darkBg: "dark:bg-[#3a1c22]", darkText: "dark:text-[#d9a3af]" },
};

export function LocationChipPicker({
  investorId,
  initialLocations,
  onChange,
}: {
  investorId: string;
  initialLocations: Location[];
  onChange?: () => void;
}) {
  const [chips, setChips] = useState<Location[]>(initialLocations);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [searching, startSearch] = useTransition();
  const [pending, startPending] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const result = await searchLocations(q);
        if (result.success) {
          // Filter out already-added chips
          const ids = new Set(chips.map((c) => c.id));
          setSuggestions(result.data.filter((l) => !ids.has(l.id)));
        }
      });
    }, 150);
    return () => clearTimeout(t);
  }, [query, chips]);

  function handleAdd(location: Location) {
    setQuery("");
    setSuggestions([]);
    setChips((prev) => [...prev, location]);
    startPending(async () => {
      const result = await addInvestorLocation(investorId, location.id);
      if (!result.success) {
        alert("Could not add location: " + result.error);
        setChips((prev) => prev.filter((c) => c.id !== location.id));
        return;
      }
      onChange?.();
    });
  }

  function handleRemove(location: Location) {
    setChips((prev) => prev.filter((c) => c.id !== location.id));
    startPending(async () => {
      const result = await removeInvestorLocation(investorId, location.id);
      if (!result.success) {
        alert("Could not remove location: " + result.error);
        setChips((prev) => [...prev, location]);
        return;
      }
      onChange?.();
    });
  }

  async function handleCreateAndAdd(name: string) {
    const result = await createLocation({ name, kind: "city" });
    if (!result.success) {
      alert("Could not create location: " + result.error);
      return;
    }
    handleAdd(result.data);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 min-h-[60px]">
        {chips.length === 0 && (
          <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No locations yet. Add one below.</span>
        )}
        {chips.map((c) => {
          const s = KIND_STYLES[c.kind];
          return (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${s.bg} ${s.border} ${s.text} ${s.darkBg} ${s.darkText}`}
            >
              <span>{s.icon}</span>
              <span>{c.name}</span>
              <span className="opacity-50">{c.kind}</span>
              <button
                onClick={() => handleRemove(c)}
                disabled={pending}
                className="ml-1 font-semibold opacity-70 hover:opacity-100"
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a location… (city, county, region)"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />

        {(suggestions.length > 0 || (query.trim().length >= 2 && !searching)) && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleAdd(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {s.kind}{s.state_code ? ` · ${s.state_code}` : ""}
                </span>
              </button>
            ))}
            {query.trim().length >= 2 && (
              <button
                onClick={() => handleCreateAndAdd(query.trim())}
                className="block w-full border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left text-sm text-[#5D3954] dark:text-[#b890ac] hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                + Create new location &ldquo;{query.trim()}&rdquo; as city
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/LocationChipPicker.tsx
git commit -m "feat(ui): add LocationChipPicker with typeahead + create-on-the-fly"
```

---

### Task 10: DealsSentPanel component

**Files:**
- Create: `src/components/DealsSentPanel.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/DealsSentPanel.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDealsSentForInvestor, type DealSentRow } from "@/actions/deal-sends";

function formatRelative(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DealsSentPanel({ investorId }: { investorId: string }) {
  const [rows, setRows] = useState<DealSentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getDealsSentForInvestor(investorId);
      if (cancelled) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [investorId]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Could not load deals sent: {error}</p>;
  if (rows === null) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Deals Sent <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">({rows.length})</span>
        </h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Auto-tracked when &ldquo;sent&rdquo; is ticked</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
          No deals sent yet. Tick &ldquo;sent&rdquo; on the matching popup to start tracking.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => {
            const isNewest = idx === 0;
            const borderClass = isNewest
              ? "border-l-4 border-[#5D3954] bg-[#ebeee0] dark:bg-[#2a2f1c]"
              : "border-l-4 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900";
            return (
              <Link
                key={row.send_id}
                href={`/app/marketing-page-creator/edit/${row.listing_page_id}`}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 ${borderClass} hover:opacity-90`}
              >
                <div>
                  <span className={`text-sm ${isNewest ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-medium text-neutral-700 dark:text-neutral-200"}`}>
                    {row.address}
                  </span>
                  {row.price && (
                    <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">${row.price}</span>
                  )}
                </div>
                <span className={`text-xs ${isNewest ? "font-semibold text-[#5D3954] dark:text-[#b890ac]" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {formatRelative(row.sent_at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-4 rounded-md border-l-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="text-neutral-900 dark:text-neutral-100">Track responses in Notes.</strong>{" "}
        This panel only records what was sent and when. Yes/no/maybe replies still go in the Notes section above.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/DealsSentPanel.tsx
git commit -m "feat(ui): add DealsSentPanel auto-populated from deal_sends"
```

---

### Task 11: Wire LocationChipPicker into InvestorForm

**Files:**
- Modify: `src/components/InvestorForm.tsx`

- [ ] **Step 1: Read the current InvestorForm to find the locations_of_interest textarea**

Find the `<textarea>` bound to `locations_of_interest` in the file. Replace it with a hint that locations are added after creation via the chip picker.

```typescript
// Replace the locations_of_interest <textarea> block with this notice:
<div className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-3 text-sm text-neutral-600 dark:text-neutral-400">
  After saving, add structured locations (cities, counties, regions) on the investor record. The free-text field is no longer used.
</div>
```

If the form uses `locations_of_interest` as a required validated field, also pass an empty string to satisfy the schema:

```typescript
// In the form submit handler, ensure locations_of_interest defaults to empty:
locations_of_interest: "",
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/InvestorForm.tsx
git commit -m "feat(ui): replace locations_of_interest textarea with post-create chip picker hint"
```

---

### Task 12: Wire LocationChipPicker + DealsSentPanel into investor record

**Files:**
- Modify: `src/app/app/dispositions/investor-record/[id]/client.tsx`

- [ ] **Step 1: Remove the auto-migrate effect**

Find the `useEffect` block at ~lines 64–88 that runs `addInvestorLocation` for each split string. Delete it entirely along with the `migrated` ref and the `// Auto-migrate locations_of_interest text into investor_locations tags` comment.

- [ ] **Step 2: Remove the inline location input UI**

Find the existing inline chip rendering and "Add location" input block in the JSX. Replace with:

```tsx
<LocationChipPicker
  investorId={investor.id}
  initialLocations={(investor.locations ?? [])
    .map((il) => il.location)
    .filter((l): l is NonNullable<typeof l> => !!l)}
  onChange={() => router.refresh()}
/>
```

Remove `locationInput`, `setLocationInput`, `showLocationInput`, `setShowLocationInput`, `locationRef`, and `handleAddLocation` if they exist — `LocationChipPicker` owns all that now.

- [ ] **Step 3: Add the import**

At the top:
```typescript
import { LocationChipPicker } from "@/components/LocationChipPicker";
import { DealsSentPanel } from "@/components/DealsSentPanel";
```

- [ ] **Step 4: Replace the free-text Deals Sent textarea with DealsSentPanel**

Search for the "Deals Sent" label / textarea bound to `deals_notes` or similar. Replace the whole panel with:

```tsx
<DealsSentPanel investorId={investor.id} />
```

If `deals_notes` is still used elsewhere (e.g. inside the Notes section), leave that. Only the auto-populated "Deals Sent" panel is being replaced.

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/dispositions/investor-record/[id]/client.tsx
git commit -m "feat(ui): swap inline chips + free-text deals sent for new picker + auto panel"
```

---

### Task 13: FindInvestorsDialog component

**Files:**
- Create: `src/components/FindInvestorsDialog.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/FindInvestorsDialog.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getMatchingInvestors,
  markSent,
  unmarkSent,
  type MatchingInvestorRow,
} from "@/actions/deal-sends";

function formatRelative(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FindInvestorsDialog({
  listingPageId,
  address,
  price,
  onClose,
  onSentChange,
}: {
  listingPageId: string;
  address: string;
  price: string;
  onClose: () => void;
  onSentChange?: () => void;
}) {
  const [rows, setRows] = useState<MatchingInvestorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, startToggle] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getMatchingInvestors(listingPageId, { showAll });
      if (cancelled) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [listingPageId, showAll]);

  function handleToggle(investorId: string, currentlySent: boolean) {
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.investor.id === investorId
              ? { ...r, sent_at: currentlySent ? null : new Date().toISOString() }
              : r
          )
        : prev
    );
    startToggle(async () => {
      const action = currentlySent ? unmarkSent : markSent;
      const result = await action(listingPageId, investorId);
      if (!result.success) {
        alert("Save failed: " + result.error);
        setRows((prev) =>
          prev
            ? prev.map((r) =>
                r.investor.id === investorId
                  ? { ...r, sent_at: currentlySent ? new Date().toISOString() : null }
                  : r
              )
            : prev
        );
        return;
      }
      onSentChange?.();
    });
  }

  const sent = (rows ?? []).filter((r) => r.sent_at !== null);
  const notSent = (rows ?? []).filter((r) => r.sent_at === null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#5D3954] px-5 py-3.5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">📨 Investors matching this deal</div>
              <div className="mt-0.5 text-xs opacity-90">{address} — ${price}</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-2xl leading-none opacity-80 hover:opacity-100">×</button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-[#ebeee0] dark:bg-[#2a2f1c] px-5 py-2.5 text-xs text-neutral-900 dark:text-neutral-100">
          <div>
            <strong>{sent.length} of {(rows ?? []).length} sent</strong>
            {notSent.length > 0 && (
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">{notSent.length} still to go</span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[#5D3954]"
            />
            <span>Show all investors</span>
          </label>
        </div>

        {error && (
          <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {showAll
              ? "No active investors."
              : "This deal isn't linked to any locations yet, or no investors match. Add locations on the edit page to find matches."}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {sent.length > 0 && sent.map((row) => (
            <Row
              key={row.investor.id}
              row={row}
              onToggle={() => handleToggle(row.investor.id, true)}
            />
          ))}
          {notSent.length > 0 && (
            <div className="border-y border-[#e6d573] bg-[#fff8d6] dark:bg-[#332e10] px-5 py-2 text-xs font-semibold uppercase tracking-wider text-[#6b5500] dark:text-[#e6d573]">
              Not sent yet
            </div>
          )}
          {notSent.map((row) => (
            <Row
              key={row.investor.id}
              row={row}
              onToggle={() => handleToggle(row.investor.id, false)}
              dim={!row.is_match}
            />
          ))}
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-5 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
          Changes save automatically.
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  onToggle,
  dim = false,
}: {
  row: MatchingInvestorRow;
  onToggle: () => void;
  dim?: boolean;
}) {
  const sent = row.sent_at !== null;
  const interestsLabel = row.location_interests.length === 0
    ? "No locations set"
    : row.location_interests.map((l) => l.name).join(", ");
  return (
    <div
      className={`grid grid-cols-[36px_1fr_110px] items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 ${sent ? "bg-white dark:bg-neutral-900" : "bg-[#fffdf0] dark:bg-[#1a1a0e]"} ${dim ? "opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        checked={sent}
        onChange={onToggle}
        className="scale-125 accent-[#5D3954]"
        aria-label={`Mark ${row.investor.name} as sent`}
      />
      <div>
        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {row.investor.name}
          {!row.is_match && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Not a location match</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          Wants: {interestsLabel}
          {row.is_match && row.match_location_name && row.match_location_kind && row.match_location_kind !== "city" && (
            <span className="ml-1 text-[#5D3954] dark:text-[#b890ac]"> · Matched on {row.match_location_name} ({row.match_location_kind})</span>
          )}
        </div>
      </div>
      <div className="text-right text-xs font-semibold text-[#5D3954] dark:text-[#b890ac]">
        {sent && row.sent_at && `Sent ${formatRelative(row.sent_at)}`}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/FindInvestorsDialog.tsx
git commit -m "feat(ui): add FindInvestorsDialog with sent/not-sent split and show-all toggle"
```

---

### Task 14: Find Investors button on Active Pages table

**Files:**
- Modify: `src/app/app/marketing-page-creator/page.tsx`
- Modify: `src/app/app/marketing-page-creator/client.tsx`

- [ ] **Step 1: Fetch match counts on the server in page.tsx**

In `src/app/app/marketing-page-creator/page.tsx`, after the existing `const { data: activeData } = ...` query, add:

```typescript
import { getMatchCountsForListingPages } from "@/actions/deal-sends";

// after activeData is set:
const activeIds = pages.map((p) => p.id);
const countsResult = await getMatchCountsForListingPages(activeIds);
const counts = countsResult.success ? countsResult.data : {};
```

Then pass `counts` into the `<ActivePagesTable>` component:

```tsx
<ActivePagesTable initialPages={pages} archivedPages={archivedPages} counts={counts} />
```

- [ ] **Step 2: Add the button + dialog to client.tsx**

In `src/app/app/marketing-page-creator/client.tsx`:

1. Add import:
```typescript
import { FindInvestorsDialog } from "@/components/FindInvestorsDialog";
import type { MatchCounts } from "@/actions/deal-sends";
```

2. Update the `ActivePagesTable` signature:
```typescript
export function ActivePagesTable({
  initialPages,
  archivedPages,
  counts,
}: {
  initialPages: ActiveListingPageWithLead[];
  archivedPages: (ListingPage & { leads: { name: string } | null })[];
  counts: Record<string, MatchCounts>;
}) {
```

3. Add state:
```typescript
const [openDialogFor, setOpenDialogFor] = useState<ActiveListingPageWithLead | null>(null);
```

4. Update the grid column template from `grid-cols-[120px_1fr_100px_120px_80px_120px]` to `grid-cols-[120px_1fr_100px_120px_80px_160px]` to fit the new button (both occurrences — header row and data row).

5. In the actions cell of each row, add the button **before** the existing icons:

```tsx
{(() => {
  const c = counts[page.id] ?? { matching: 0, sent: 0 };
  const remaining = c.matching - c.sent;
  const isFilled = remaining > 0;
  return (
    <button
      onClick={() => setOpenDialogFor(page)}
      className={`mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
        isFilled
          ? "bg-[#5D3954] text-white hover:bg-[#4a2d43]"
          : "border border-[#5D3954] bg-white dark:bg-neutral-900 text-[#5D3954] dark:text-[#b890ac]"
      }`}
      title={isFilled ? `${remaining} matching investor${remaining === 1 ? "" : "s"} not yet sent` : "All matching investors sent"}
    >
      📨 Find Investors ({remaining})
    </button>
  );
})()}
```

6. At the bottom of the component's JSX, render the dialog conditionally:

```tsx
{openDialogFor && (
  <FindInvestorsDialog
    listingPageId={openDialogFor.id}
    address={openDialogFor.address}
    price={openDialogFor.price}
    onClose={() => setOpenDialogFor(null)}
    onSentChange={() => {
      // trigger a refresh of counts by reloading the page
      window.location.reload();
    }}
  />
)}
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/marketing-page-creator/page.tsx src/app/app/marketing-page-creator/client.tsx
git commit -m "feat(ui): add Find Investors (N) button + dialog to Active Pages table"
```

---

### Task 15: Auto-link locations on listing page create

**Files:**
- Modify: `src/actions/listing-pages.ts`

- [ ] **Step 1: After the successful insert in createListingPage, attempt to auto-link**

In `createListingPage` in `src/actions/listing-pages.ts`, replace the final return statement:

```typescript
// Replace: return { success: true, data: data as ListingPage }
// With:
const created = data as ListingPage

// Auto-link to a matching city location based on input.city (case-insensitive exact match)
if (input.city && input.city.trim().length > 0) {
  const { data: matchedLoc } = await supabase
    .from('locations')
    .select('id')
    .ilike('name', input.city.trim())
    .eq('kind', 'city')
    .limit(1)
    .maybeSingle()

  if (matchedLoc?.id) {
    await supabase
      .from('listing_page_locations')
      .insert({ listing_page_id: created.id, location_id: matchedLoc.id })
  }
}

return { success: true, data: created }
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/actions/listing-pages.ts
git commit -m "feat(actions): auto-link new listing pages to matching city location"
```

---

### Task 16: Add Locations chip section to listing page edit

**Files:**
- Modify: `src/app/app/marketing-page-creator/edit/[id]/page.tsx`
- Modify: `src/app/app/marketing-page-creator/create/client.tsx` (the edit form is the same component)

- [ ] **Step 1: Create a ListingPageLocationsEditor component**

Create `src/components/ListingPageLocationsEditor.tsx`:

```typescript
"use client";

import { useEffect, useState, useTransition } from "react";
import { searchLocations, getLocationsForListingPage, setListingPageLocations } from "@/actions/locations";
import type { Location, LocationKind } from "@/lib/types";

const KIND_STYLES: Record<LocationKind, string> = {
  city: "bg-[#ebeee0] dark:bg-[#2a2f1c] text-[#3d4a1c] dark:text-[#dce5b8] border-[#c5cca8]",
  neighborhood: "bg-[#ebeee0] dark:bg-[#2a2f1c] text-[#3d4a1c] dark:text-[#dce5b8] border-[#c5cca8]",
  county: "bg-[#ddebe5] dark:bg-[#1a2f25] text-[#1f4d3a] dark:text-[#9ec8b6] border-[#88b59f]",
  region: "bg-[#e0e3eb] dark:bg-[#1c2240] text-[#2a3458] dark:text-[#a3afd9] border-[#99a3c2]",
  state: "bg-[#f0e3eb] dark:bg-[#3a1c22] text-[#58342a] dark:text-[#d9a3af] border-[#c099a3]",
};

export function ListingPageLocationsEditor({ listingPageId }: { listingPageId: string }) {
  const [chips, setChips] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [, startPending] = useTransition();

  useEffect(() => {
    (async () => {
      const r = await getLocationsForListingPage(listingPageId);
      if (r.success) setChips(r.data);
      setLoading(false);
    })();
  }, [listingPageId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await searchLocations(q);
      if (r.success) {
        const ids = new Set(chips.map((c) => c.id));
        setSuggestions(r.data.filter((l) => !ids.has(l.id)));
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, chips]);

  function save(next: Location[]) {
    startPending(async () => {
      const result = await setListingPageLocations(listingPageId, next.map((c) => c.id));
      if (!result.success) {
        alert("Could not save locations: " + result.error);
      }
    });
  }

  function handleAdd(loc: Location) {
    const next = [...chips, loc];
    setChips(next);
    setQuery("");
    setSuggestions([]);
    save(next);
  }

  function handleRemove(id: string) {
    const next = chips.filter((c) => c.id !== id);
    setChips(next);
    save(next);
  }

  if (loading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading locations…</p>;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Locations covered
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2.5 min-h-[44px]">
        {chips.length === 0 && (
          <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No locations set — investors won&rsquo;t see this deal as a match.</span>
        )}
        {chips.map((c) => (
          <span
            key={c.id}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${KIND_STYLES[c.kind]}`}
          >
            <span>{c.name}</span>
            <span className="opacity-50">{c.kind}</span>
            <button onClick={() => handleRemove(c.id)} className="ml-1 font-semibold" aria-label={`Remove ${c.name}`}>×</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a location…"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleAdd(s)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{s.kind}{s.state_code ? ` · ${s.state_code}` : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Insert the editor into the edit page**

In `src/app/app/marketing-page-creator/edit/[id]/page.tsx`, after the existing form is rendered, add the locations editor in a new section. Find a sensible insertion point in the page-level layout (near the page metadata controls).

```tsx
import { ListingPageLocationsEditor } from "@/components/ListingPageLocationsEditor";

// inside the page render:
<section className="mt-6 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
  <ListingPageLocationsEditor listingPageId={id} />
</section>
```

(Where `id` is the page id available via params.)

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListingPageLocationsEditor.tsx src/app/app/marketing-page-creator/edit/[id]/page.tsx
git commit -m "feat(ui): add locations chip editor to listing page edit"
```

---

### Task 17: Migration UI

**Files:**
- Create: `src/app/app/dispositions/migrate-locations/page.tsx`
- Create: `src/app/app/dispositions/migrate-locations/client.tsx`

- [ ] **Step 1: Server component to fetch unlinked investors**

```typescript
// src/app/app/dispositions/migrate-locations/page.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser, requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MigrateLocationsClient } from "./client";

export const dynamic = "force-dynamic";

export type UnmigratedInvestor = {
  id: string;
  name: string;
  company: string | null;
  locations_of_interest: string | null;
  unlinked_names: string[];
};

export default async function MigrateLocationsPage() {
  const user = await getAuthUser();
  try {
    requireAdmin(user);
  } catch {
    redirect("/app");
  }

  const supabase = await createServerClient();

  // Investors with rows in investor_locations whose location_id IS NULL,
  // OR with non-empty locations_of_interest and no investor_locations rows at all.
  const { data: investors } = await supabase
    .from("investors")
    .select("id, name, company, locations_of_interest, investor_locations(id, location_id, location_name)")
    .order("name", { ascending: true });

  const unmigrated: UnmigratedInvestor[] = ((investors ?? []) as Array<{
    id: string;
    name: string;
    company: string | null;
    locations_of_interest: string | null;
    investor_locations: Array<{ id: string; location_id: string | null; location_name: string | null }>;
  }>)
    .map((inv) => {
      const unlinked = inv.investor_locations
        .filter((il) => il.location_id === null && il.location_name)
        .map((il) => il.location_name as string);
      // Also surface investors who have free-text but no rows at all
      if (unlinked.length === 0 && inv.investor_locations.length === 0 && inv.locations_of_interest) {
        const parts = inv.locations_of_interest.split(/[;,]+/).map((s) => s.trim()).filter(Boolean);
        return { id: inv.id, name: inv.name, company: inv.company, locations_of_interest: inv.locations_of_interest, unlinked_names: parts };
      }
      return { id: inv.id, name: inv.name, company: inv.company, locations_of_interest: inv.locations_of_interest, unlinked_names: unlinked };
    })
    .filter((row) => row.unlinked_names.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 border-b border-dashed border-neutral-300 dark:border-neutral-700 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Migrate Locations ({unmigrated.length} left)
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Map free-text location strings to structured locations. Click a suggestion to add it; create a new location if none match.
        </p>
      </header>

      <MigrateLocationsClient investors={unmigrated} />
    </main>
  );
}
```

- [ ] **Step 2: Client UI**

```typescript
// src/app/app/dispositions/migrate-locations/client.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchLocations, createLocation } from "@/actions/locations";
import { addInvestorLocation } from "@/actions/investors";
import type { Location } from "@/lib/types";
import type { UnmigratedInvestor } from "./page";

export function MigrateLocationsClient({ investors }: { investors: UnmigratedInvestor[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (investors.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700 p-4 text-sm text-green-900 dark:text-green-100">
        ✅ All investors migrated. Nothing left to do.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {investors.filter((i) => !hidden.has(i.id)).map((inv) => (
        <InvestorRow
          key={inv.id}
          investor={inv}
          onDone={() => {
            setHidden((s) => new Set(s).add(inv.id));
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

function InvestorRow({ investor, onDone }: { investor: UnmigratedInvestor; onDone: () => void }) {
  const [resolvedNames, setResolvedNames] = useState<Set<string>>(new Set());
  return (
    <div className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{investor.name}</div>
          {investor.company && <div className="text-xs text-neutral-500 dark:text-neutral-400">{investor.company}</div>}
        </div>
        <button
          onClick={onDone}
          className="rounded-md bg-[#5D3954] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a2d43]"
        >
          Mark as migrated
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {investor.unlinked_names.map((name) => (
          <NameResolver
            key={name}
            investorId={investor.id}
            name={name}
            resolved={resolvedNames.has(name)}
            onResolved={() => setResolvedNames((s) => new Set(s).add(name))}
          />
        ))}
      </div>
    </div>
  );
}

function NameResolver({
  investorId,
  name,
  resolved,
  onResolved,
}: {
  investorId: string;
  name: string;
  resolved: boolean;
  onResolved: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Location[] | null>(null);
  const [pending, startPending] = useTransition();

  async function load() {
    if (suggestions !== null) return;
    const r = await searchLocations(name);
    if (r.success) setSuggestions(r.data);
  }

  function handleAdd(locationId: string) {
    startPending(async () => {
      const r = await addInvestorLocation(investorId, locationId);
      if (r.success) onResolved();
      else alert(r.error);
    });
  }

  function handleCreate(kind: "city" | "county" | "region" | "state" | "neighborhood") {
    startPending(async () => {
      const created = await createLocation({ name, kind });
      if (!created.success) {
        alert(created.error);
        return;
      }
      const linked = await addInvestorLocation(investorId, created.data.id);
      if (linked.success) onResolved();
      else alert(linked.error);
    });
  }

  return (
    <div className={`rounded border border-neutral-200 dark:border-neutral-800 p-2.5 ${resolved ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-900 dark:text-neutral-100">
          {resolved && "✓ "}
          &ldquo;{name}&rdquo;
        </span>
        {!resolved && (
          <button
            onClick={load}
            disabled={pending}
            className="text-xs text-[#5D3954] dark:text-[#b890ac] hover:underline"
          >
            Find matches
          </button>
        )}
      </div>
      {suggestions !== null && !resolved && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.length === 0 && <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No matches.</span>}
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleAdd(s.id)}
              disabled={pending}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              {s.name} <span className="opacity-50">({s.kind})</span>
            </button>
          ))}
          <span className="text-xs text-neutral-500 dark:text-neutral-400">or create as:</span>
          {(["city", "county", "region", "state", "neighborhood"] as const).map((k) => (
            <button
              key={k}
              onClick={() => handleCreate(k)}
              disabled={pending}
              className="rounded-md border border-dashed border-[#5D3954] px-2 py-1 text-xs text-[#5D3954] dark:text-[#b890ac] hover:bg-[#5D3954] hover:text-white"
            >
              + {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/dispositions/migrate-locations/
git commit -m "feat(ui): add migrate-locations page for cleaning up free-text data"
```

---

### Task 18: Version bump

**Files:**
- Modify: `src/components/VersionLabel.tsx`

- [ ] **Step 1: Bump version**

Find the current version string (e.g. `4.22.10`) in `src/components/VersionLabel.tsx` and replace it with `4.23.0`.

- [ ] **Step 2: Run full test + lint**

```bash
npm run test && npm run lint
```
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/VersionLabel.tsx
git commit -m "chore: bump version to 4.23.0 for dispositions workflow"
```

---

## Phase 5 — Manual verification

### Task 19: End-to-end manual smoke test

Not committable — Randy walks through the workflow on the dev server and reports any issues.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```
Expected: starts on port 3000 (or the configured port) without errors.

- [ ] **Step 2: Verify migration UI**

Navigate to `/app/dispositions/migrate-locations`. Expected: shows the list of unmigrated investors. Pick one, find matches or create new locations, click "Mark as migrated." Verify the row disappears.

- [ ] **Step 3: Verify investor record**

Open any investor record at `/app/dispositions/investor-record/<id>`. Expected: chips render under "Locations of Interest" (or wherever the picker was placed). Add a chip via typeahead — verify it persists on refresh. Remove a chip — verify it disappears.

- [ ] **Step 4: Verify Deals Sent panel**

On the same investor record, scroll to the new "Deals Sent" panel. Expected: empty state initially or shows previously-sent deals if any. The free-text textarea is gone.

- [ ] **Step 5: Verify Find Investors flow**

Go to `/app/marketing-page-creator`. Expected: each active page row has a "📨 Find Investors (N)" button. Click one. Expected: dialog opens showing matching investors with their location interests. Tick a checkbox — verify the row moves to the "sent" section. Untick — verify it moves back. Toggle "Show all investors" — verify non-matching investors appear with a dimmed style.

- [ ] **Step 6: Verify Deals Sent panel updates**

Open the investor record for someone you just ticked. Expected: the deal appears in their Deals Sent panel.

- [ ] **Step 7: Verify auto-link on create**

Create a new marketing page for a property in "Seattle" (or any seeded city). Open the edit page. Expected: the Locations editor shows the city already linked.

---

## Spec Coverage Check

Every section of the spec is implemented:
- ✅ Structured locations (Tasks 1, 2, 4, 5, 6)
- ✅ Hierarchy-aware matching (Task 3, the SQL function; Task 8, the action)
- ✅ Find Investors button + popup (Tasks 13, 14)
- ✅ Deals Sent panel (Tasks 8, 10, 12)
- ✅ Migration UI (Task 17)
- ✅ Auto-link deal to location (Task 15)
- ✅ Locations editor on listing page edit (Task 16)
- ✅ Dark mode variants throughout (every component spec includes `dark:` classes)
- ✅ RLS on all new tables (Tasks 1, 3)
- ✅ Edge cases (zero locations, ticking/unticking, show-all toggle — covered in Tasks 13, 14)
