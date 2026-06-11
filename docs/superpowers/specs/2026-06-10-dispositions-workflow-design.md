# Dispositions Workflow — Design

**Date:** 2026-06-10
**Status:** Approved (verbal, 2026-06-10)
**Author:** Randy + Claude

---

## Problem

Randy currently runs dispositions manually:
- He memorizes which investors care about which areas
- He matches deals to investors by hand (scanning the free-text `investors.locations_of_interest` field)
- He types deal names into a free-text "Deals Sent" textarea on each investor record after sending a text

Pain: error-prone, slow, no audit trail, and it doesn't scale as the investor list grows.

## Goal

Replace the manual process with a structured workflow that:
1. **Suggests matching investors** for any active marketing page based on structured location interests
2. **Tracks who's been sent what** via a simple checkbox model — Randy still sends texts manually
3. **Auto-populates each investor's Deals Sent history** from those checkboxes — replaces today's free-text panel

## Non-Goals (explicitly out of scope)

- Outcome tracking (interested / passed / offer made) — stays in the existing Notes section on each investor
- Automated text sending — Randy texts manually, the system only records what was sent
- Slice 3 "polish" passes — those happen after Randy uses slices 1+2 for a few days

## Architecture

Three coordinated changes that ship together:

**A. Structured locations.** New `locations` table (cities, counties, regions) with parent/child hierarchy. New `investor_locations` join table replaces the free-text `locations_of_interest` field. New `listing_page_locations` join table ties each deal to the cities/regions it covers (many-to-many to support portfolio deals).

**B. Find-Investors flow.** New `deal_sends` table records which investor was sent which marketing page and when. New "Find Investors (N)" button on the Active Pages table opens a popup with checkbox rows.

**C. Deals Sent panel.** The existing free-text "Deals Sent" textarea on the investor record is replaced with an auto-populated list driven by `deal_sends`.

The migration UI for existing free-text data ships as part of A.

---

## Data Model

### New tables

**`locations`** — the universe of regions Randy cares about.

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('city', 'county', 'region', 'state', 'neighborhood')),
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  state_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX locations_parent_id_idx ON locations(parent_id);
CREATE INDEX locations_name_idx ON locations(lower(name));
CREATE UNIQUE INDEX locations_name_kind_state_idx
  ON locations(lower(name), kind, COALESCE(state_code, ''));
```

Seed with: WA state, King County, Pierce County, Snohomish County, plus every city Randy currently has a deal or investor for (~30 cities). Pacific NW as a region with WA + OR + ID as state children. Easy to extend.

**`investor_locations`** — replaces `investors.locations_of_interest`.

```sql
CREATE TABLE investor_locations (
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (investor_id, location_id)
);

CREATE INDEX investor_locations_location_id_idx ON investor_locations(location_id);
```

**`listing_page_locations`** — the cities/regions a deal covers (usually one, but allow many for portfolio deals).

```sql
CREATE TABLE listing_page_locations (
  listing_page_id UUID NOT NULL REFERENCES listing_pages(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_page_id, location_id)
);

CREATE INDEX listing_page_locations_location_id_idx ON listing_page_locations(location_id);
```

**`deal_sends`** — the source of truth for "I sent this deal to this investor."

```sql
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
```

Unticking a checkbox = DELETE the row. Ticking = INSERT. Simple, idempotent, auditable via `sent_at`.

### Changes to existing tables

- `investors.locations_of_interest` — **kept for now** (read-only fallback during migration, removed in a follow-up migration after Randy confirms cleanup is complete)
- No changes to `listing_pages` itself — location ties go through the new join table

### RLS

All four new tables: authenticated users can SELECT. Only admins can INSERT/UPDATE/DELETE — matches the existing pattern from `investors` and `listing_pages`.

---

## Hierarchy-Aware Matching

The matching query for a given deal:

```sql
WITH RECURSIVE deal_location_tree AS (
  -- Start: the deal's direct locations
  SELECT location_id FROM listing_page_locations WHERE listing_page_id = $1

  UNION

  -- Walk up: include all ancestors
  SELECT l.parent_id
  FROM locations l
  JOIN deal_location_tree dlt ON l.id = dlt.location_id
  WHERE l.parent_id IS NOT NULL
)
SELECT DISTINCT i.id, i.name, i.company
FROM investors i
JOIN investor_locations il ON il.investor_id = i.id
WHERE il.location_id IN (SELECT location_id FROM deal_location_tree)
  AND i.status = 'active';
```

Plain English: a deal in Sammamish (city) → walk to King County (parent) → walk to WA (parent) → walk to Pacific NW (parent). Any investor whose interests include *any* of those four levels matches.

This single query powers the popup. Add `LEFT JOIN deal_sends ds ON ds.investor_id = i.id AND ds.listing_page_id = $1` to compute the "sent" flag and `sent_at` per row.

---

## UX Surfaces

### 1. Investor record — location chip picker

Replaces the existing `<textarea>` on `src/app/app/dispositions/investor-record/[id]/client.tsx` and on `src/components/InvestorForm.tsx`.

- Pills/chips per location: `📍 Seattle (city) ×`, `🏛 King County (county) ×`, `🌲 Pacific NW (region) ×`
- Color-coded by kind (city = olive, county = green, region = navy)
- Typeahead input below: searches `locations` by name (case-insensitive substring), shows top 8 matches with kind + state
- "Create new" affordance in the typeahead dropdown when no match — opens a tiny modal asking name + kind + parent
- Adds save inline via a server action — no separate "save locations" button
- Dark mode: chip backgrounds and text both have `dark:` variants

### 2. Investor record — Deals Sent panel

Replaces the existing free-text textarea (find the one labeled "Deals Sent" in `investor-record/[id]/client.tsx`).

- Header: `Deals Sent (N)` with an inline note "Auto-tracked when 'sent' is ticked"
- One row per `deal_sends` entry, ordered by `sent_at DESC`
- Newest row: plum (#5D3954) left border, light olive background (`#ebeee0` light / `bg-plum/15` dark)
- Older rows: neutral grey left border, transparent background
- Row content: `{address}` (bold) — `${price}` (muted) — right-aligned: `{relative date e.g. "Jun 8"}`
- Click row → navigates to `/app/marketing-page-creator/edit/{listing_page_id}` (existing edit page)
- Empty state: "No deals sent yet. Tick 'sent' on the matching popup to start tracking."
- Footnote: "Track responses in Notes above."

### 3. Active Pages table — "Find Investors (N)" button

Added to `src/app/app/marketing-page-creator/client.tsx` in the actions column.

- Replaces or sits alongside existing per-row icons
- Label format: `📨 Find Investors (N)` where N = `matching_count - sent_count`
- N is computed server-side on page load via a single query that joins all listing pages with their matching/sent counts
- Filled plum background when N > 0, outlined plum when N = 0 (everyone matching already sent)
- Click → opens the matching popup as a modal

### 4. Matching popup

New component `src/components/FindInvestorsDialog.tsx`.

- Modal, plum header with deal address + price
- Progress strip: `"3 of 12 sent — 9 still to go"`
- Two visual groups: **Sent** (top, white background) and **Not sent yet** (bottom, soft yellow strip divider, light yellow row background `#fffdf0`)
- Each row: checkbox + investor name + their location interests + sent date (if applicable)
- **"Show all investors" toggle** at top — when on, also shows investors who don't match the deal's locations (sorted alphabetically below the matched list, with a "Not a location match" subtle tag)
- Checkbox ticks/unticks auto-save (debounced 250ms) via a server action that inserts/deletes from `deal_sends`
- Footer: "Changes save automatically."
- Dark mode: all backgrounds, borders, and text variants

### 5. Migration UI

New page `src/app/app/dispositions/migrate-locations/page.tsx`.

- Admin-only (Randy-only in practice)
- Lists every investor with `locations_of_interest IS NOT NULL` and no `investor_locations` rows yet
- Per investor: shows current text, lets Randy tick existing locations from a picker, and offers "Create new" for unrecognized regions
- "Mark as migrated" button per row → inserts `investor_locations` rows, hides this investor from the list (the row stays in DB; we just hide it once it has any `investor_locations` link)
- Header: "(N) investors left to migrate"
- One-time use, but lives in the codebase so future bulk imports can use it too

---

## Server Actions

New file: `src/actions/locations.ts`

- `searchLocations(query: string)` — typeahead search, returns top 8
- `createLocation({ name, kind, parent_id, state_code })` — admin only
- `addInvestorLocation(investor_id, location_id)` — admin
- `removeInvestorLocation(investor_id, location_id)` — admin
- `setListingPageLocations(listing_page_id, location_ids[])` — admin

New file: `src/actions/deal-sends.ts`

- `getMatchingInvestors(listing_page_id, { showAll: boolean })` — returns the popup data (investors + sent state)
- `markSent(listing_page_id, investor_id)` — admin
- `unmarkSent(listing_page_id, investor_id)` — admin
- `getDealsSentForInvestor(investor_id)` — for the panel on the investor record
- `getMatchCountsForListingPages(listing_page_ids[])` — for the "Find Investors (N)" button labels

Existing `getListingPages` action: extend to include `matching_count` and `sent_count` per row, computed in one query.

---

## Auto-link deal → location on create

When a new marketing page is created, attempt to auto-link it to a `locations` row by matching `city` (case-insensitive) against `locations.name` where `kind = 'city'`. If a match is found, insert into `listing_page_locations`. If no match, leave it unlinked and surface a soft warning on the listing edit page ("This deal isn't linked to a location — add one to enable investor matching").

Edit page gets a new "Locations" chip picker section so Randy can add/fix the link manually.

---

## Edge Cases

- **Investor with zero structured locations** — won't appear in match results. Show in "Show all investors" mode with a subtle "No locations set" tag.
- **Deal with zero locations** — popup shows empty state "This deal isn't linked to any locations. Add one on the edit page to find matching investors." with a button to the edit page.
- **Unticking a previously-sent investor** — DELETES the `deal_sends` row. The Deals Sent panel updates immediately. This is intentional — Randy might tick by mistake.
- **Duplicate locations** — the unique index on `(lower(name), kind, state_code)` prevents accidental dupes. The typeahead surfaces existing matches before offering "Create new."
- **Deleted location** — `ON DELETE SET NULL` on `parent_id`, `CASCADE` on join tables. A deleted parent orphans its children (they become top-level), which is recoverable in the UI.

---

## Testing

- Vitest unit tests for `searchLocations`, `getMatchingInvestors`, `markSent`/`unmarkSent`
- Schema test: recursive CTE returns correct ancestor chain for known seed data
- Integration test: tick checkbox → row in `deal_sends` → appears in investor's Deals Sent panel
- Manual test: full workflow on a real deal + 2-3 real investors after deploy

---

## Rollout

Ship as one bundled release:
1. Migration `058_dispositions_locations.sql` (creates all four tables, seeds initial locations)
2. Location chip picker on investor record + migration UI
3. Auto-link logic on listing page create
4. Find Investors button + popup
5. Replace investor record Deals Sent textarea with auto-populated panel
6. Randy migrates existing investor data via the migration UI (one sitting, ~30 min)
7. Drop the deprecated `locations_of_interest` column in a follow-up migration after a stable week

Version bump expected to land at 4.23.x.
