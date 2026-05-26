# Listing Page v2 — Design Spec

**Date:** 2026-05-25
**Author:** Randy + Claude (brainstorm session)
**Status:** Approved — ready for implementation planning

## Goal

Replace the v1 public listing page (the "investor flyer" served at `/deals/html/[slug]`) with a v2 style that feels like an extension of `btinvestments.co` — same fonts, palette, editorial rhythm — while keeping all the investor-facing content v1 already has.

v1 stays available for existing rows. New listing pages default to v2.

## Visual reference

The locked mockup lives at `.superpowers/brainstorm/600-1779761984/content/full-page-v3.html` (also reproduced below in section-by-section detail). Implementation should match it closely.

Key shared tokens from `globals.css` (re-used, not duplicated):

- Colors: `--mkt-cream`, `--mkt-cream-dim`, `--mkt-dark`, `--mkt-olive`, `--mkt-olive-light`, `--mkt-text-on-light`, `--mkt-muted-light`, `--mkt-muted-dark` (and a new `--mkt-olive-pale: #cdcb95` for dark-band display numbers)
- Fonts: `--font-cormorant` (Cormorant Garamond) for serif display, `--font-inter` for body/labels
- Eyebrow color: `#76794c` (the brighter "INVESTMENTS" olive)

The page must render inside `.marketing-scope` so it picks up the marketing font/color rules and overrides any `/app` dark-mode bleed.

## Page anatomy (top to bottom)

1. **Nav strip** — `BT Investments` wordmark on the left, small uppercase "Off-Market Opportunity" status on the right. Same wordmark treatment as the marketing site (Cormorant `BT` + tracked-out Inter `Investments`).
2. **Hero** — eyebrow city/state · serif address (h1, ~64px) · subtitle paragraph · dashed-rule meta row showing Price / EMD / Close.
3. **Hero photo** — single 5:3 framed photo, rounded `14px` corners.
4. **"Text us" band** — cream-dim background, dashed olive border, message bubble icon, "Interested? Text us / Fastest way to lock this deal" copy, olive pill CTA with the phone number (`sms:+14259712331`).
5. **Property Highlights section** — eyebrow ("At a Glance" — default; configurable per-page later) · serif h2 ("Property Highlights") · hairline rule · pill row with key facts · two-photo grid (front + satellite).
6. **Diligence link cards** — two link cards side-by-side under the photo grid: "County Records → View Parcel Page" and "Google Drive → Photos & Documents." Each is a cream card with circled olive icon.
7. **ARV dark band** — full-width dark card (rounded). Eyebrow "Comparable Sales" in olive-pale · serif h2 "Estimated ARV based off nearby sales" · big olive-pale range (e.g. `$385K – $420K`) · small muted note explaining the comp window.
8. **Neighborhood section** — eyebrow "The Neighborhood" · serif h2 with the neighborhood/city name (e.g. "Bremerton") · 16:9 photo (either preset from library or admin-uploaded custom). Section is hideable per-listing.
9. **Footer dark band** — eyebrow "Make a Move" · serif h2 "Lock this deal — text us." · olive pill with phone number · disclaimer paragraph · `BT INVESTMENTS` brand mark.

### What's removed vs v1

- Standalone "Terms" section — redundant with the hero meta row (Price/EMD/Close). The As-Is/buyer-compliance language moves into the footer disclaimer.
- The map-only "Area Map" section — replaced by the Neighborhood section. The `mapPhotoUrl` input is no longer required for v2.
- The plain olive button CTAs for County / Google Drive — replaced by link cards.

### What's renamed

- "Nearby Sales (last ~3 months)" → "Estimated ARV based off nearby sales" (the locked phrasing per Randy).

## Architectural decision: render from data, not AI

**Recommendation:** v2 stops storing AI-generated `html_content`. Instead, v2 rows render via a React Server Component at request time, reading the structured `inputs` JSON.

Why:

- We designed every pixel — there's no creative judgment left for an LLM to make. Calling GPT-4o per page introduces visual drift across pages and costs tokens for zero benefit.
- Live RSC rendering means design edits ship instantly to all v2 pages (vs needing to re-generate per row).
- Faster create flow (no API round-trip on submit).

How:

- `style_id = 'listing-page-v2'` rows store `html_content = ''` (or are exempt from the NOT-NULL constraint via migration). The `/deals/html/[slug]` route checks `style_id` and routes v1 rows to the existing HTML viewer, v2 rows to a new server component.
- v1 rows keep working — same route, same render path, no change.

If we ever want LLM-generated *copy* inside a v2 page (e.g., the subtitle), that's a separate call done at create time and stored as a plain text field — not a full HTML blob.

## Data model

Stay inside `listing_pages.inputs JSONB` for v2 fields — no column additions needed beyond what's already there. Validate with a Zod schema.

```ts
// src/lib/validations/listing-page-v2.ts
export const ListingPageV2Inputs = z.object({
  // Existing v1 fields kept as-is
  address: z.string(),
  price: z.string(),
  beds: z.number(),
  baths: z.number(),
  sqft: z.number(),
  lotSize: z.string(),
  yearBuilt: z.number(),
  zoning: z.string(),
  occupancy: z.string().optional(),
  arvRange: z.string(),                 // renamed from nearbySalesRange in v2
  countyPageLink: z.string().url(),
  googleDriveLink: z.string().url(),
  frontPhotoPath: z.string(),           // storage path in listing-page-photos bucket
  satellitePhotoPath: z.string(),
  customSubtitle: z.string().optional(),
  // mapPhotoUrl is dropped for v2

  // New v2 fields
  cityEyebrow: z.string(),              // "Bremerton, WA" — shown above the address
  highlightsEyebrow: z.string().default('At a Glance'),
  highlightBullets: z.array(z.string()).max(8).optional(),  // optional free-form descriptive pills like "Big, flat backyard"

  neighborhood: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('preset'), slug: z.string(), label: z.string() }),
    z.object({ mode: z.literal('custom'), photoPath: z.string(), label: z.string() }),
    z.object({ mode: z.literal('hidden') }),
  ]),
})
```

Notes:

- `arvRange` is the human-typed string ("$385K – $420K") — no structural change, just a label rename. The admin form's "Nearby Sales Range" input becomes "ARV Range (low – high)".
- `customSubtitle` keeps the v1 escape hatch; if missing, we display a deterministic generated subtitle (no AI needed — concatenate beds/baths/sqft/lot/year). Drop the AI subtitle path entirely.

## Neighborhood preset library

A static registry of `(slug, displayName, photoPath, region)`. Photos live in `/public/marketing/neighborhoods/<slug>.jpg`. Start with the cities BT already maps in `CityMarquee` + the major Seattle proper neighborhoods. Library grows over time as photos are added.

```ts
// src/lib/listing-pages/neighborhoods.ts
export const NEIGHBORHOOD_PRESETS = [
  // Seattle proper
  { slug: 'ballard',           label: 'Ballard',           region: 'Seattle' },
  { slug: 'capitol-hill',      label: 'Capitol Hill',      region: 'Seattle' },
  { slug: 'queen-anne',        label: 'Queen Anne',        region: 'Seattle' },
  { slug: 'fremont',           label: 'Fremont',           region: 'Seattle' },
  { slug: 'wallingford',       label: 'Wallingford',       region: 'Seattle' },
  { slug: 'greenwood',         label: 'Greenwood',         region: 'Seattle' },
  { slug: 'phinney-ridge',     label: 'Phinney Ridge',     region: 'Seattle' },
  { slug: 'magnolia',          label: 'Magnolia',          region: 'Seattle' },
  { slug: 'west-seattle',      label: 'West Seattle',      region: 'Seattle' },
  { slug: 'beacon-hill',       label: 'Beacon Hill',       region: 'Seattle' },
  { slug: 'columbia-city',     label: 'Columbia City',     region: 'Seattle' },
  { slug: 'rainier-beach',     label: 'Rainier Beach',     region: 'Seattle' },
  { slug: 'georgetown',        label: 'Georgetown',        region: 'Seattle' },
  { slug: 'sodo',              label: 'SoDo',              region: 'Seattle' },
  { slug: 'pioneer-square',    label: 'Pioneer Square',    region: 'Seattle' },
  { slug: 'belltown',          label: 'Belltown',          region: 'Seattle' },
  { slug: 'south-lake-union',  label: 'South Lake Union',  region: 'Seattle' },
  { slug: 'eastlake',          label: 'Eastlake',          region: 'Seattle' },
  { slug: 'roosevelt',         label: 'Roosevelt',         region: 'Seattle' },
  { slug: 'ravenna',           label: 'Ravenna',           region: 'Seattle' },
  { slug: 'university-district', label: 'University District', region: 'Seattle' },
  { slug: 'northgate',         label: 'Northgate',         region: 'Seattle' },
  { slug: 'lake-city',         label: 'Lake City',         region: 'Seattle' },
  { slug: 'maple-leaf',        label: 'Maple Leaf',        region: 'Seattle' },
  { slug: 'green-lake',        label: 'Green Lake',        region: 'Seattle' },
  { slug: 'madison-park',      label: 'Madison Park',      region: 'Seattle' },
  { slug: 'madrona',           label: 'Madrona',           region: 'Seattle' },
  { slug: 'mount-baker',       label: 'Mount Baker',       region: 'Seattle' },

  // Eastside
  { slug: 'bellevue',          label: 'Bellevue',          region: 'Eastside' },
  { slug: 'kirkland',          label: 'Kirkland',          region: 'Eastside' },
  { slug: 'redmond',           label: 'Redmond',           region: 'Eastside' },
  { slug: 'sammamish',         label: 'Sammamish',         region: 'Eastside' },
  { slug: 'issaquah',          label: 'Issaquah',          region: 'Eastside' },
  { slug: 'bothell',           label: 'Bothell',           region: 'Eastside' },
  { slug: 'kenmore',           label: 'Kenmore',           region: 'Eastside' },
  { slug: 'mercer-island',     label: 'Mercer Island',     region: 'Eastside' },

  // South King
  { slug: 'renton',            label: 'Renton',            region: 'South King' },
  { slug: 'kent',              label: 'Kent',              region: 'South King' },
  { slug: 'auburn',            label: 'Auburn',            region: 'South King' },
  { slug: 'federal-way',       label: 'Federal Way',       region: 'South King' },
  { slug: 'burien',            label: 'Burien',            region: 'South King' },
  { slug: 'tukwila',           label: 'Tukwila',           region: 'South King' },
  { slug: 'seatac',            label: 'SeaTac',            region: 'South King' },
  { slug: 'des-moines',        label: 'Des Moines',        region: 'South King' },

  // North Sound
  { slug: 'lynnwood',          label: 'Lynnwood',          region: 'North Sound' },
  { slug: 'edmonds',           label: 'Edmonds',           region: 'North Sound' },
  { slug: 'mountlake-terrace', label: 'Mountlake Terrace', region: 'North Sound' },
  { slug: 'shoreline',         label: 'Shoreline',         region: 'North Sound' },
  { slug: 'monroe',            label: 'Monroe',            region: 'North Sound' },
  { slug: 'mill-creek',        label: 'Mill Creek',        region: 'North Sound' },
  { slug: 'mukilteo',          label: 'Mukilteo',          region: 'North Sound' },
  { slug: 'everett',           label: 'Everett',           region: 'North Sound' },
  { slug: 'marysville',        label: 'Marysville',        region: 'North Sound' },
  { slug: 'bellingham',        label: 'Bellingham',        region: 'North Sound' },

  // South Sound
  { slug: 'tacoma',            label: 'Tacoma',            region: 'South Sound' },
  { slug: 'lakewood',          label: 'Lakewood',          region: 'South Sound' },
  { slug: 'university-place',  label: 'University Place',  region: 'South Sound' },
  { slug: 'puyallup',          label: 'Puyallup',          region: 'South Sound' },
  { slug: 'olympia',           label: 'Olympia',           region: 'South Sound' },
  { slug: 'gig-harbor',        label: 'Gig Harbor',        region: 'South Sound' },

  // Kitsap
  { slug: 'bremerton',         label: 'Bremerton',         region: 'Kitsap' },
  { slug: 'port-orchard',      label: 'Port Orchard',      region: 'Kitsap' },
  { slug: 'silverdale',        label: 'Silverdale',        region: 'Kitsap' },
  { slug: 'poulsbo',           label: 'Poulsbo',           region: 'Kitsap' },

  // Other WA
  { slug: 'vancouver',         label: 'Vancouver',         region: 'Other WA' },
  { slug: 'yakima',            label: 'Yakima',            region: 'Other WA' },
  { slug: 'spokane',           label: 'Spokane',           region: 'Other WA' },
] as const

// Only entries whose photo exists in /public/marketing/neighborhoods/<slug>.jpg
// should be surfaced as selectable in the admin form. The list above is the
// full taxonomy; the photo library will fill in over time.
export function neighborhoodPresetPhotoPath(slug: string): string {
  return `/marketing/neighborhoods/${slug}.jpg`
}
```

**Photo library cold-start:** The library will be empty initially. The admin form must support:

1. Selecting a preset *slug* (even if no preset photo exists yet — uses custom upload).
2. Uploading a custom photo for this listing.
3. Hiding the neighborhood section entirely.

When a preset photo eventually lands in `/public/marketing/neighborhoods/<slug>.jpg`, all existing v2 pages keyed to that slug automatically pick it up (since render-from-data is live).

## Admin form changes (`marketing-page-creator/create`)

Add to the existing form:

- **Style picker** at the top: radio of `v1 / v2` — default `v2`. Switches which fields are shown/required.
- **City eyebrow** field — defaults to parsed city + `WA`.
- **Highlights eyebrow** field — text input, defaults to "At a Glance".
- **Highlight bullets** — repeatable text inputs (max 8) for the optional descriptive pills.
- **ARV Range** — relabeled (was "Nearby Sales Range").
- **Neighborhood block** — three-mode picker:
  - Mode tabs: `Preset | Custom Photo | Hide`
  - Preset mode: searchable dropdown of the registry above + label override
  - Custom mode: photo upload (same flow as front/satellite) + label text input
  - Hidden mode: nothing else needed
- For v2, the `Map Photo` field is removed from required.

The v1 fields keep working when v1 style is selected.

## Routing & rendering

```
/deals/html/[slug]
  └─ load listing_pages row by slug
       ├─ if style_id === 'listing-page-v1' → existing HtmlViewerClient
       └─ if style_id === 'listing-page-v2' → new <ListingPageV2 inputs={…} />
```

New file:

- `src/components/listing-pages/ListingPageV2.tsx` — server component, takes parsed `inputs` and renders the full page (nav, hero, sections, footer). Internally split into sub-components per section if helpful (`HeroBlock`, `TextUsBand`, `HighlightsSection`, `DiligenceLinks`, `ArvBand`, `NeighborhoodSection`, `FooterBand`) — same file or co-located, judgment call during implementation.
- `src/lib/listing-pages/neighborhoods.ts` — the registry above.
- `src/lib/validations/listing-page-v2.ts` — Zod schema.

The v2 component scope-wraps its tree in `<div className="marketing-scope">…</div>` so font/color vars resolve correctly.

## Migration plan

1. New code ships behind the `style_id` value. No DB migration needed (the column already exists; `inputs` is JSONB).
2. Default `style_id` for the create form switches to `listing-page-v2`.
3. Existing v1 rows continue to render via the existing path indefinitely. No backfill.
4. The OpenAI generate route (`/api/listing-pages/generate`) is unused for v2. Leave it in place so v1 still works; revisit deleting once v1 is no longer used.

## Print behavior

v2 is no longer a print-first one-pager. It's intentionally screen-first since investors view on phone/laptop. If we discover a print use case later, we can add an `@media print` stylesheet — out of scope for v1 of v2.

## Out of scope

- Editing existing v2 pages after creation (still create-only, like v1).
- Live ARV computation from comp data (the `arvRange` field stays human-typed).
- Animations / scroll effects à la `framer-motion` (the marketing site uses these heavily — v2 stays static for now; we can add subtle motion in a follow-up if Randy wants).
- A standalone "Recent Deals" index page at `/deals` (out of scope; the share URL is `/deals/html/[slug]`).

## Open questions (resolve during implementation planning)

1. **Eyebrow default** — locked to "At a Glance" per the brainstorm; admin can override per-page. No followup needed unless Randy wants a different default.
2. **`html_content` NOT NULL** — schema currently requires it. For v2 rows we'll insert an empty string. If we want a cleaner model, add a migration to make it nullable. Defer the decision to implementation — both work.
3. **Cold-start preset photos** — does Randy have a few neighborhood photos ready to seed, or do we ship the registry empty and rely on custom upload until photos are sourced? (Answer: ship empty, use custom upload — confirmed during brainstorm.)
