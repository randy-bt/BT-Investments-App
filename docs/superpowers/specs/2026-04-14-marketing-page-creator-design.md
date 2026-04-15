# Marketing Page Creator — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Overview

Automates the creation of one-page HTML marketing flyers for properties going to market. Replaces the manual workflow of filling in prompt placeholders, pasting into ChatGPT, and copying HTML output. The module provides a form that pre-fills property data from existing lead records, uploads photos to Supabase Storage, calls GPT-4o to generate the HTML, and stores the result for future reference.

## Database Changes

### New table: `listing_pages`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| lead_id | UUID | References `leads(id)` ON DELETE SET NULL, nullable |
| property_id | UUID | References `properties(id)` ON DELETE SET NULL, nullable |
| address | TEXT NOT NULL | Stored directly for self-contained history display |
| price | TEXT NOT NULL | |
| html_content | TEXT NOT NULL | The generated HTML |
| inputs | JSONB NOT NULL | Snapshot of all form inputs used to generate |
| is_active | BOOLEAN NOT NULL DEFAULT true | Visual toggle for user reference only |
| created_by | UUID NOT NULL | References `users(id)` |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

RLS: authenticated users can manage all rows (matches existing patterns).

### Alter table: `properties`

Add column: `zoning TEXT` (nullable).

## Routes

### Module page: `/app/marketing-page-creator`

Existing placeholder page, replaced with:

- **Header**: "Marketing Page Creator" title + "+ Create New Page" button (navigates to `/app/marketing-page-creator/create`)
- **History table**: All previously generated pages, ordered by `created_at` desc
  - Columns: Address, Price, Date Created, Active/Inactive toggle (far right)
  - Click a row to expand and reveal:
    - Full HTML in a code block
    - "Copy HTML" button
  - Active/Inactive toggle: simple switch that updates `is_active` in the database. Visual reference only — does not affect anything else.

### Create form page: `/app/marketing-page-creator/create`

#### Lead & Property Selection

1. **Lead selector dropdown** — searchable, lists leads by name
2. **Property selector** — appears after selecting a lead. Auto-selects if only one property. Dropdown if multiple.

#### Form Fields

After selection, the form pre-fills from the lead/property record. All fields are editable. Fields that are empty after pre-fill are visually highlighted (e.g. red/warning border).

**Pre-filled from system:**

| Field | Source |
|-------|--------|
| Address | `property.address` |
| Price | `lead.asking_price` |
| Beds | `property.bedrooms` |
| Baths | `property.bathrooms` |
| Sqft | `property.sqft` |
| Lot Size | `property.lot_size` |
| Year Built | `property.year_built` |
| Zoning | `property.zoning` |
| County Page Link | Constructed from `property.county` + `property.apn` using existing `COUNTY_URLS` map |
| Occupancy | `lead.occupancy_status` |

**Always manual (user must provide):**

| Field | Notes |
|-------|-------|
| Nearby Sales Range | e.g. "$350k-$425k (similar size)" |
| Google Drive Photos Link | URL |
| Front Photo | File upload, stored in Supabase Storage |
| Satellite Photo | File upload, stored in Supabase Storage |
| Map Photo | File upload, stored in Supabase Storage |

#### Validation

The "Generate" button is disabled until every required field has a value. Required fields: address, price, beds, baths, sqft, lot size, year built, zoning, county page link, nearby sales range, Google Drive link, and all 3 photos.

Occupancy is optional (matches the original prompt behavior — "only if stated").

#### Generation Flow

1. Generate a UUID for the listing page record up front
2. Upload 3 photos to Supabase Storage (`listing-pages/{uuid}/front.ext`, `satellite.ext`, `map.ext`), get public URLs
3. Assemble the prompt with all provided data — AI does NOT need web search
4. Call GPT-4o (standard, no web_search_preview tool)
5. AI writes: subtitle (one factual sentence), notable features (1-3 pill items), and assembles the complete HTML from the template
6. Save to `listing_pages` table with the pre-generated UUID (html_content + inputs JSON snapshot)
7. Display the result with a "Copy HTML" button

## AI Prompt Design

The prompt and HTML template live in a single file: `src/lib/prompts/listing-page.ts`.

The prompt provides all property data directly (no web search needed) and asks the AI to:
1. Write a factual subtitle sentence
2. Write 1-3 notable feature pills
3. Fill in the HTML template with all provided values
4. Return only the final HTML

The HTML template is the same one from the user's existing workflow (embedded in the prompt file as a string constant). Future design changes only require editing this one file.

## Zoning Addition to Scraper & PropertyCard

### Scraper (`src/lib/scraper.ts`)

- Add `zoning` to `ScrapedPropertyData` type
- In `scrapePellego`: extract `p.zoning` from the Pellego API response
- If not available from API: when fetching the Lotside property page (already done for county URL extraction), also look for zoning text in the HTML

### PropertyCard (`src/components/PropertyCard.tsx`)

- Add `{ label: "Zoning", key: "zoning", type: "text" }` to one of the field columns (left or right, whichever has fewer items)
- Legal description remains full-width below the two-column grid — unchanged

### Type & Validation Updates

- Add `zoning: string | null` to `Property` type in `src/lib/types.ts`
- Add `zoning: z.string().optional()` to `addPropertySchema`
- Add `zoning: z.string().nullish()` to `updatePropertySchema`

## File Structure (new files)

```
supabase/migrations/032_zoning.sql
supabase/migrations/033_listing_pages.sql
src/actions/listing-pages.ts
src/lib/prompts/listing-page.ts
src/app/app/marketing-page-creator/page.tsx          (replace placeholder)
src/app/app/marketing-page-creator/create/page.tsx
src/app/app/marketing-page-creator/client.tsx
src/app/app/marketing-page-creator/create/client.tsx
```

## Files Modified

```
src/lib/types.ts                        (add zoning to Property, add ListingPage type)
src/lib/validations/properties.ts       (add zoning)
src/lib/scraper.ts                      (add zoning extraction)
src/components/PropertyCard.tsx          (add zoning to field grid)
```
