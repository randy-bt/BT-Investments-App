# Listing Page v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a redesigned public listing page that mirrors the marketing site's editorial style (Cormorant serif, cream + olive palette, sectioned layout), rendered live from structured fields instead of AI-generated HTML.

**Architecture:** New `style_id = 'listing-page-v2'` rows store structured `inputs` in JSONB and render through a React Server Component at request time. v1 rows continue to render via the existing HTML viewer path. No DB migration needed (the `inputs` JSONB column already exists; `html_content` accepts an empty string).

**Tech Stack:** Next.js 16 App Router, React Server Components, Zod v4, Tailwind CSS 4, Vitest (node env — no DOM testing), Supabase storage (existing `listing-page-photos` public bucket).

**Spec reference:** `docs/superpowers/specs/2026-05-25-listing-page-v2-design.md`

**Visual reference:** `.superpowers/brainstorm/600-1779761984/content/full-page-v3.html`

---

## File Structure

**Create:**
- `src/lib/listing-pages/neighborhoods.ts` — preset registry + helpers
- `src/lib/validations/listing-page-v2.ts` — Zod schema for v2 `inputs`
- `src/components/listing-pages/ListingPageV2.tsx` — server component, full page rendered from structured `inputs`
- `src/__tests__/lib/listing-pages/neighborhoods.test.ts` — unit tests for registry
- `src/__tests__/lib/validations/listing-page-v2.test.ts` — unit tests for schema
- `public/marketing/neighborhoods/.gitkeep` — placeholder for the preset photo library

**Modify:**
- `src/app/globals.css` — add `--mkt-olive-pale` token in `.marketing-scope`
- `src/app/deals/html/[slug]/page.tsx` — branch on `style_id`
- `src/app/app/marketing-page-creator/create/client.tsx` — style picker, v2 form fields, neighborhood block, v2 submit path

---

## Task 1: Neighborhood preset registry

**Files:**
- Create: `src/lib/listing-pages/neighborhoods.ts`
- Test: `src/__tests__/lib/listing-pages/neighborhoods.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/lib/listing-pages/neighborhoods.test.ts
import { describe, it, expect } from 'vitest'
import {
  NEIGHBORHOOD_PRESETS,
  findNeighborhoodPreset,
  neighborhoodPresetPhotoPath,
} from '@/lib/listing-pages/neighborhoods'

describe('NEIGHBORHOOD_PRESETS', () => {
  it('has unique slugs', () => {
    const slugs = NEIGHBORHOOD_PRESETS.map((n) => n.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every entry has slug, label, and region', () => {
    for (const entry of NEIGHBORHOOD_PRESETS) {
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/)
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.region.length).toBeGreaterThan(0)
    }
  })
})

describe('findNeighborhoodPreset', () => {
  it('returns the entry for a known slug', () => {
    const entry = findNeighborhoodPreset('bremerton')
    expect(entry?.label).toBe('Bremerton')
  })

  it('returns undefined for an unknown slug', () => {
    expect(findNeighborhoodPreset('atlantis')).toBeUndefined()
  })
})

describe('neighborhoodPresetPhotoPath', () => {
  it('returns the public path for a slug', () => {
    expect(neighborhoodPresetPhotoPath('ballard')).toBe('/marketing/neighborhoods/ballard.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/__tests__/lib/listing-pages/neighborhoods.test.ts
```

Expected: FAIL — module `@/lib/listing-pages/neighborhoods` not found.

- [ ] **Step 3: Implement the registry**

```ts
// src/lib/listing-pages/neighborhoods.ts

export type NeighborhoodRegion =
  | 'Seattle'
  | 'Eastside'
  | 'South King'
  | 'North Sound'
  | 'South Sound'
  | 'Kitsap'
  | 'Other WA'

export type NeighborhoodPreset = {
  slug: string
  label: string
  region: NeighborhoodRegion
}

export const NEIGHBORHOOD_PRESETS: readonly NeighborhoodPreset[] = [
  // Seattle proper
  { slug: 'ballard',             label: 'Ballard',             region: 'Seattle' },
  { slug: 'capitol-hill',        label: 'Capitol Hill',        region: 'Seattle' },
  { slug: 'queen-anne',          label: 'Queen Anne',          region: 'Seattle' },
  { slug: 'fremont',             label: 'Fremont',             region: 'Seattle' },
  { slug: 'wallingford',         label: 'Wallingford',         region: 'Seattle' },
  { slug: 'greenwood',           label: 'Greenwood',           region: 'Seattle' },
  { slug: 'phinney-ridge',       label: 'Phinney Ridge',       region: 'Seattle' },
  { slug: 'magnolia',            label: 'Magnolia',            region: 'Seattle' },
  { slug: 'west-seattle',        label: 'West Seattle',        region: 'Seattle' },
  { slug: 'beacon-hill',         label: 'Beacon Hill',         region: 'Seattle' },
  { slug: 'columbia-city',       label: 'Columbia City',       region: 'Seattle' },
  { slug: 'rainier-beach',       label: 'Rainier Beach',       region: 'Seattle' },
  { slug: 'georgetown',          label: 'Georgetown',          region: 'Seattle' },
  { slug: 'sodo',                label: 'SoDo',                region: 'Seattle' },
  { slug: 'pioneer-square',      label: 'Pioneer Square',      region: 'Seattle' },
  { slug: 'belltown',            label: 'Belltown',            region: 'Seattle' },
  { slug: 'south-lake-union',    label: 'South Lake Union',    region: 'Seattle' },
  { slug: 'eastlake',            label: 'Eastlake',            region: 'Seattle' },
  { slug: 'roosevelt',           label: 'Roosevelt',           region: 'Seattle' },
  { slug: 'ravenna',             label: 'Ravenna',             region: 'Seattle' },
  { slug: 'university-district', label: 'University District', region: 'Seattle' },
  { slug: 'northgate',           label: 'Northgate',           region: 'Seattle' },
  { slug: 'lake-city',           label: 'Lake City',           region: 'Seattle' },
  { slug: 'maple-leaf',          label: 'Maple Leaf',          region: 'Seattle' },
  { slug: 'green-lake',          label: 'Green Lake',          region: 'Seattle' },
  { slug: 'madison-park',        label: 'Madison Park',        region: 'Seattle' },
  { slug: 'madrona',             label: 'Madrona',             region: 'Seattle' },
  { slug: 'mount-baker',         label: 'Mount Baker',         region: 'Seattle' },

  // Eastside
  { slug: 'bellevue',            label: 'Bellevue',            region: 'Eastside' },
  { slug: 'kirkland',            label: 'Kirkland',            region: 'Eastside' },
  { slug: 'redmond',             label: 'Redmond',             region: 'Eastside' },
  { slug: 'sammamish',           label: 'Sammamish',           region: 'Eastside' },
  { slug: 'issaquah',            label: 'Issaquah',            region: 'Eastside' },
  { slug: 'bothell',             label: 'Bothell',             region: 'Eastside' },
  { slug: 'kenmore',             label: 'Kenmore',             region: 'Eastside' },
  { slug: 'mercer-island',       label: 'Mercer Island',       region: 'Eastside' },

  // South King
  { slug: 'renton',              label: 'Renton',              region: 'South King' },
  { slug: 'kent',                label: 'Kent',                region: 'South King' },
  { slug: 'auburn',              label: 'Auburn',              region: 'South King' },
  { slug: 'federal-way',         label: 'Federal Way',         region: 'South King' },
  { slug: 'burien',              label: 'Burien',              region: 'South King' },
  { slug: 'tukwila',             label: 'Tukwila',             region: 'South King' },
  { slug: 'seatac',              label: 'SeaTac',              region: 'South King' },
  { slug: 'des-moines',          label: 'Des Moines',          region: 'South King' },

  // North Sound
  { slug: 'lynnwood',            label: 'Lynnwood',            region: 'North Sound' },
  { slug: 'edmonds',             label: 'Edmonds',             region: 'North Sound' },
  { slug: 'mountlake-terrace',   label: 'Mountlake Terrace',   region: 'North Sound' },
  { slug: 'shoreline',           label: 'Shoreline',           region: 'North Sound' },
  { slug: 'monroe',              label: 'Monroe',              region: 'North Sound' },
  { slug: 'mill-creek',          label: 'Mill Creek',          region: 'North Sound' },
  { slug: 'mukilteo',            label: 'Mukilteo',            region: 'North Sound' },
  { slug: 'everett',             label: 'Everett',             region: 'North Sound' },
  { slug: 'marysville',          label: 'Marysville',          region: 'North Sound' },
  { slug: 'bellingham',          label: 'Bellingham',          region: 'North Sound' },

  // South Sound
  { slug: 'tacoma',              label: 'Tacoma',              region: 'South Sound' },
  { slug: 'lakewood',            label: 'Lakewood',            region: 'South Sound' },
  { slug: 'university-place',    label: 'University Place',    region: 'South Sound' },
  { slug: 'puyallup',            label: 'Puyallup',            region: 'South Sound' },
  { slug: 'olympia',             label: 'Olympia',             region: 'South Sound' },
  { slug: 'gig-harbor',          label: 'Gig Harbor',          region: 'South Sound' },

  // Kitsap
  { slug: 'bremerton',           label: 'Bremerton',           region: 'Kitsap' },
  { slug: 'port-orchard',        label: 'Port Orchard',        region: 'Kitsap' },
  { slug: 'silverdale',          label: 'Silverdale',          region: 'Kitsap' },
  { slug: 'poulsbo',             label: 'Poulsbo',             region: 'Kitsap' },

  // Other WA
  { slug: 'vancouver',           label: 'Vancouver',           region: 'Other WA' },
  { slug: 'yakima',              label: 'Yakima',              region: 'Other WA' },
  { slug: 'spokane',             label: 'Spokane',             region: 'Other WA' },
] as const

export function findNeighborhoodPreset(slug: string): NeighborhoodPreset | undefined {
  return NEIGHBORHOOD_PRESETS.find((n) => n.slug === slug)
}

export function neighborhoodPresetPhotoPath(slug: string): string {
  return `/marketing/neighborhoods/${slug}.jpg`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/__tests__/lib/listing-pages/neighborhoods.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Create the photo library placeholder dir**

```bash
mkdir -p "public/marketing/neighborhoods" && touch "public/marketing/neighborhoods/.gitkeep"
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/listing-pages/neighborhoods.ts src/__tests__/lib/listing-pages/neighborhoods.test.ts public/marketing/neighborhoods/.gitkeep
git commit -m "$(cat <<'EOF'
Add neighborhood preset registry for listing page v2

Seeds the WA-wide library (Seattle proper + Eastside, South King,
North Sound, South Sound, Kitsap, Other WA). Photos at
/marketing/neighborhoods/<slug>.jpg fill in over time; admin form
falls back to custom upload until each slug has a preset photo.
EOF
)"
```

---

## Task 2: V2 Zod validation schema

**Files:**
- Create: `src/lib/validations/listing-page-v2.ts`
- Test: `src/__tests__/lib/validations/listing-page-v2.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/lib/validations/listing-page-v2.test.ts
import { describe, it, expect } from 'vitest'
import { ListingPageV2Inputs } from '@/lib/validations/listing-page-v2'

const validBase = {
  address: '2419 Walnut Ave, Bremerton, WA 98310',
  price: '$285,000',
  beds: 3,
  baths: 1,
  sqft: 1120,
  lotSize: '6,970 sf',
  yearBuilt: 1948,
  zoning: 'R-1',
  arvRange: '$385K – $420K',
  countyPageLink: 'https://psearch.kitsapgov.com/details.asp?RPID=ABC123',
  googleDriveLink: 'https://drive.google.com/drive/folders/abc',
  frontPhotoPath: 'listing-page-photos/abc/front.jpg',
  satellitePhotoPath: 'listing-page-photos/abc/satellite.jpg',
  cityEyebrow: 'Bremerton, WA',
  neighborhood: { mode: 'hidden' as const },
}

describe('ListingPageV2Inputs', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = ListingPageV2Inputs.parse(validBase)
    expect(parsed.highlightsEyebrow).toBe('At a Glance')
  })

  it('accepts neighborhood preset mode', () => {
    const parsed = ListingPageV2Inputs.parse({
      ...validBase,
      neighborhood: { mode: 'preset', slug: 'bremerton', label: 'Bremerton' },
    })
    expect(parsed.neighborhood.mode).toBe('preset')
  })

  it('accepts neighborhood custom mode', () => {
    const parsed = ListingPageV2Inputs.parse({
      ...validBase,
      neighborhood: {
        mode: 'custom',
        photoPath: 'listing-page-photos/abc/neighborhood.jpg',
        label: 'Bremerton',
      },
    })
    expect(parsed.neighborhood.mode).toBe('custom')
  })

  it('rejects an unknown neighborhood mode', () => {
    expect(() =>
      ListingPageV2Inputs.parse({
        ...validBase,
        neighborhood: { mode: 'rocket' },
      }),
    ).toThrow()
  })

  it('rejects highlightBullets longer than 8', () => {
    expect(() =>
      ListingPageV2Inputs.parse({
        ...validBase,
        highlightBullets: Array(9).fill('Bullet'),
      }),
    ).toThrow()
  })

  it('rejects non-URL countyPageLink', () => {
    expect(() => ListingPageV2Inputs.parse({ ...validBase, countyPageLink: 'not-a-url' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/__tests__/lib/validations/listing-page-v2.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

```ts
// src/lib/validations/listing-page-v2.ts
import { z } from 'zod'

const NeighborhoodPresetSchema = z.object({
  mode: z.literal('preset'),
  slug: z.string().min(1),
  label: z.string().min(1),
})

const NeighborhoodCustomSchema = z.object({
  mode: z.literal('custom'),
  photoPath: z.string().min(1),
  label: z.string().min(1),
})

const NeighborhoodHiddenSchema = z.object({
  mode: z.literal('hidden'),
})

export const NeighborhoodInputSchema = z.discriminatedUnion('mode', [
  NeighborhoodPresetSchema,
  NeighborhoodCustomSchema,
  NeighborhoodHiddenSchema,
])

export const ListingPageV2Inputs = z.object({
  // Carried over from v1
  address: z.string().min(1),
  price: z.string().min(1),
  beds: z.number().int().nonnegative(),
  baths: z.number().nonnegative(),
  sqft: z.number().int().nonnegative(),
  lotSize: z.string().min(1),
  yearBuilt: z.number().int(),
  zoning: z.string().min(1),
  occupancy: z.string().optional(),
  arvRange: z.string().min(1),
  countyPageLink: z.string().url(),
  googleDriveLink: z.string().url(),
  frontPhotoPath: z.string().min(1),
  satellitePhotoPath: z.string().min(1),
  customSubtitle: z.string().optional(),

  // New for v2
  cityEyebrow: z.string().min(1),
  highlightsEyebrow: z.string().default('At a Glance'),
  highlightBullets: z.array(z.string().min(1)).max(8).optional(),
  neighborhood: NeighborhoodInputSchema,
})

export type ListingPageV2InputsType = z.infer<typeof ListingPageV2Inputs>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- src/__tests__/lib/validations/listing-page-v2.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/listing-page-v2.ts src/__tests__/lib/validations/listing-page-v2.test.ts
git commit -m "$(cat <<'EOF'
Add Zod schema for listing page v2 inputs

Validates the structured fields stored in listing_pages.inputs JSONB
for style_id='listing-page-v2', including the discriminated union for
the neighborhood section (preset / custom / hidden).
EOF
)"
```

---

## Task 3: Add `--mkt-olive-pale` CSS token

**Files:**
- Modify: `src/app/globals.css` (the `.marketing-scope` block)

- [ ] **Step 1: Read the current marketing-scope token block**

```bash
grep -n "mkt-olive-light" src/app/globals.css
```

This locates the line where the existing olive tokens are defined inside `.marketing-scope` so the new token slots in next to them.

- [ ] **Step 2: Insert the new token**

In the `.marketing-scope` selector that defines the `--mkt-*` variables, add this line directly after `--mkt-olive-light: #747250;`:

```css
  --mkt-olive-pale: #cdcb95;
```

Also extend the documentation comment above the block so the line that lists the existing tokens has a new entry inserted between `--mkt-olive-light` and the next entry:

```
   --mkt-olive-pale    pale olive (display numbers on dark sections)
```

- [ ] **Step 3: Verify the build still parses CSS**

```bash
npm run build
```

Expected: build completes without CSS errors. (If you only want a quick check, `npm run lint` is faster and will fail on syntax issues.)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "Add --mkt-olive-pale token for listing page v2 dark sections"
```

---

## Task 4: Build the `ListingPageV2` server component

This is the single biggest task. The component is one file with inline sub-sections; no abstraction layer between them. There is no unit-test framework for React rendering in this project (Vitest is node-env only), so verification is via the dev server in the next task.

**Files:**
- Create: `src/components/listing-pages/ListingPageV2.tsx`

- [ ] **Step 1: Add the file with all sections inline**

```tsx
// src/components/listing-pages/ListingPageV2.tsx
import { createAdminClient } from '@/lib/supabase/admin'
import {
  findNeighborhoodPreset,
  neighborhoodPresetPhotoPath,
} from '@/lib/listing-pages/neighborhoods'
import type { ListingPageV2InputsType } from '@/lib/validations/listing-page-v2'

const PHONE_DISPLAY = '(425) 971-2331'
const PHONE_SMS = 'sms:+14259712331'
const PHOTOS_BUCKET = 'listing-page-photos'

function publicPhotoUrl(storagePath: string): string {
  const admin = createAdminClient()
  return admin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

function fallbackSubtitle(inputs: ListingPageV2InputsType): string {
  const parts = [
    `${inputs.beds} bed / ${inputs.baths} bath`,
    `${inputs.sqft.toLocaleString()} sf`,
    `${inputs.lotSize} lot`,
    `built ${inputs.yearBuilt}`,
  ]
  return parts.join(' · ')
}

function neighborhoodPhotoUrl(
  neighborhood: ListingPageV2InputsType['neighborhood'],
): string | null {
  if (neighborhood.mode === 'hidden') return null
  if (neighborhood.mode === 'preset') {
    return neighborhoodPresetPhotoPath(neighborhood.slug)
  }
  return publicPhotoUrl(neighborhood.photoPath)
}

export function ListingPageV2({ inputs }: { inputs: ListingPageV2InputsType }) {
  const frontUrl = publicPhotoUrl(inputs.frontPhotoPath)
  const satelliteUrl = publicPhotoUrl(inputs.satellitePhotoPath)
  const subtitle = inputs.customSubtitle?.trim() || fallbackSubtitle(inputs)
  const nbhdUrl = neighborhoodPhotoUrl(inputs.neighborhood)
  const nbhdLabel =
    inputs.neighborhood.mode === 'hidden' ? null : inputs.neighborhood.label

  return (
    <div className="marketing-scope" style={{ background: 'var(--mkt-cream)', minHeight: '100vh' }}>
      <div style={styles.page}>
        {/* NAV */}
        <div style={styles.miniNav}>
          <span style={styles.wordmark}>
            BT<span style={styles.wordmarkInvest}>Investments</span>
          </span>
          <span style={styles.navStatus}>Off-Market Opportunity</span>
        </div>

        {/* HERO */}
        <div style={styles.hero}>
          <div style={styles.eyebrow}>{inputs.cityEyebrow}</div>
          <h1 style={styles.address}>{inputs.address}</h1>
          <p style={styles.sub}>{subtitle}</p>
          <div style={styles.meta}>
            <MetaItem label="Price" value={inputs.price} accent />
            <MetaItem label="EMD" value="$10,000" />
            <MetaItem label="Close" value="ASAP" />
          </div>
        </div>

        {/* HERO PHOTO */}
        <div style={styles.heroPhotoFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frontUrl} alt={inputs.address} style={styles.fillPhoto} />
        </div>

        {/* TEXT-US BAND */}
        <div style={styles.textBand}>
          <div style={styles.textBandLeft}>
            <span style={styles.textBandIcon}>
              <MessageIcon />
            </span>
            <div style={styles.textBandCopy}>
              <span style={styles.textBandTop}>Interested? Text us</span>
              <span style={styles.textBandBot}>Fastest way to lock this deal</span>
            </div>
          </div>
          <a href={PHONE_SMS} style={styles.textBandCta}>{PHONE_DISPLAY}</a>
        </div>

        {/* PROPERTY HIGHLIGHTS */}
        <section style={styles.section}>
          <div style={styles.sectEyebrow}>{inputs.highlightsEyebrow}</div>
          <h2 style={styles.sectTitle}>Property Highlights</h2>
          <div style={styles.sectRule} />
          <div style={styles.pills}>
            <Pill><strong style={styles.pillStrong}>{inputs.beds} Bed</strong> · {inputs.baths} Bath</Pill>
            <Pill><strong style={styles.pillStrong}>{inputs.sqft.toLocaleString()}</strong> sq ft</Pill>
            <Pill><strong style={styles.pillStrong}>{inputs.lotSize}</strong> lot</Pill>
            <Pill>Built <strong style={styles.pillStrong}>{inputs.yearBuilt}</strong></Pill>
            <Pill>Zoning <strong style={styles.pillStrong}>{inputs.zoning}</strong> <span style={{ color: 'var(--mkt-muted-light)' }}>(verify)</span></Pill>
            {inputs.occupancy ? <Pill>{inputs.occupancy}</Pill> : null}
            {(inputs.highlightBullets ?? []).map((b) => <Pill key={b}>{b}</Pill>)}
          </div>

          <div style={styles.photoGrid}>
            <div style={styles.photoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frontUrl} alt="Front" style={styles.fillPhoto} />
            </div>
            <div style={styles.photoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={satelliteUrl} alt="Satellite" style={styles.fillPhoto} />
            </div>
          </div>

          {/* DILIGENCE LINKS */}
          <div style={styles.links}>
            <LinkCard
              label="County Records"
              title="View Parcel Page →"
              href={inputs.countyPageLink}
              icon={<HouseIcon />}
            />
            <LinkCard
              label="Google Drive"
              title="Photos & Documents →"
              href={inputs.googleDriveLink}
              icon={<DownloadIcon />}
            />
          </div>
        </section>

        {/* ARV DARK BAND */}
        <section style={styles.arv}>
          <div style={styles.arvEyebrow}>Comparable Sales</div>
          <h2 style={styles.arvTitle}>Estimated ARV based off nearby sales</h2>
          <div style={styles.arvRangeRow}>
            <span style={styles.arvRange}>{inputs.arvRange}</span>
          </div>
          <p style={styles.arvNote}>
            Range pulled from comparable sales within ~0.5 miles in the last three months.
            Buyer to verify with their own comps and underwriting.
          </p>
        </section>

        {/* NEIGHBORHOOD */}
        {nbhdUrl && nbhdLabel ? (
          <section style={styles.section}>
            <div style={styles.sectEyebrow}>The Neighborhood</div>
            <h2 style={styles.nbhdName}>{nbhdLabel}</h2>
            <div style={styles.nbhdPhotoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nbhdUrl} alt={nbhdLabel} style={styles.fillPhoto} />
            </div>
          </section>
        ) : null}

        {/* FOOTER */}
        <footer style={styles.footer}>
          <div style={styles.footerEyebrow}>Make a Move</div>
          <h2 style={styles.footerTitle}>Lock this deal — text us.</h2>
          <a href={PHONE_SMS} style={styles.footerCta}>{PHONE_DISPLAY}</a>
          <p style={styles.footerDisc}>
            Buyer to verify all information, zoning/uses, and compliance requirements with the City.
            As-Is; buyer responsible for compliance after closing. BT Investments LLC — Local · Simple · Direct.
          </p>
          <div style={styles.footerBrand}>BT INVESTMENTS</div>
        </footer>
      </div>
    </div>
  )
}

// ---------- sub-pieces ----------

function MetaItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={{ ...styles.metaValue, color: accent ? 'var(--mkt-olive)' : 'var(--mkt-text-on-light)' }}>{value}</span>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={styles.pill}>{children}</span>
}

function LinkCard({ label, title, href, icon }: { label: string; title: string; href: string; icon: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={styles.linkCard}>
      <span style={styles.linkCardIcon}>{icon}</span>
      <span>
        <span style={styles.linkCardLabel}>{label}</span>
        <span style={styles.linkCardTitle}>{title}</span>
      </span>
    </a>
  )
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

// ---------- inline styles (server-component-safe) ----------

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto', padding: '0 20px 80px', fontFamily: 'var(--font-inter), system-ui, sans-serif', color: 'var(--mkt-text-on-light)', lineHeight: 1.5 },
  miniNav: { padding: '24px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '0.01em' },
  wordmarkInvest: { fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: 9.5, letterSpacing: '0.42em', textTransform: 'uppercase', color: '#76794c', marginLeft: 10, verticalAlign: 'middle', fontWeight: 500 },
  navStatus: { fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },

  hero: { padding: '28px 4px 36px' },
  eyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: '#76794c', fontWeight: 500, marginBottom: 18 },
  address: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 64, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.01em', maxWidth: 640, margin: 0 },
  sub: { fontSize: 14.5, color: 'var(--mkt-muted-light)', marginTop: 18, maxWidth: 520, lineHeight: 1.55 },
  meta: { marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 42, paddingTop: 24, borderTop: '1px dashed rgba(0,0,0,.18)' },
  metaLabel: { fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },
  metaValue: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 28, fontWeight: 500, lineHeight: 1 },

  heroPhotoFrame: { position: 'relative', aspectRatio: '5/3', borderRadius: 14, overflow: 'hidden', marginTop: 8, background: 'var(--mkt-cream-dim)' },
  fillPhoto: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  textBand: { marginTop: 24, padding: '18px 22px', background: 'var(--mkt-cream-dim)', border: '1px dashed rgba(88,87,50,.4)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' },
  textBandLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  textBandIcon: { width: 38, height: 38, borderRadius: '50%', background: 'var(--mkt-olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 },
  textBandCopy: { display: 'flex', flexDirection: 'column' },
  textBandTop: { fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },
  textBandBot: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 21, color: 'var(--mkt-text-on-light)', fontWeight: 500, lineHeight: 1.1, marginTop: 2 },
  textBandCta: { fontSize: 15, fontWeight: 600, color: '#fff', background: 'var(--mkt-olive)', padding: '12px 20px', borderRadius: 999, textDecoration: 'none', letterSpacing: '0.02em' },

  section: { marginTop: 56 },
  sectEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive)', fontWeight: 600, marginBottom: 10 },
  sectTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 38, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 },
  sectRule: { height: 1, background: 'rgba(0,0,0,.12)', marginTop: 22 },

  pills: { marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 },
  pill: { fontSize: 12, letterSpacing: '0.06em', padding: '9px 14px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 999, background: 'var(--mkt-cream)', color: 'var(--mkt-text-on-light)', fontWeight: 500 },
  pillStrong: { color: 'var(--mkt-olive)', fontWeight: 700 },

  photoGrid: { marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  photoFrame: { position: 'relative', aspectRatio: '5/4', borderRadius: 12, overflow: 'hidden', background: 'var(--mkt-cream-dim)' },

  links: { marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  linkCard: { display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 12, textDecoration: 'none', color: 'var(--mkt-text-on-light)', background: 'var(--mkt-cream)' },
  linkCardIcon: { width: 38, height: 38, borderRadius: '50%', background: 'var(--mkt-cream-dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mkt-olive)', flexShrink: 0 },
  linkCardLabel: { display: 'block', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mkt-muted-light)', fontWeight: 600 },
  linkCardTitle: { display: 'block', fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 20, fontWeight: 500, marginTop: 2 },

  arv: { marginTop: 40, background: 'var(--mkt-dark)', color: 'var(--mkt-text-on-dark)', borderRadius: 18, padding: 40 },
  arvEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive-pale)', fontWeight: 600, marginBottom: 14 },
  arvTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 32, fontWeight: 500, lineHeight: 1.05, maxWidth: 540, margin: 0 },
  arvRangeRow: { marginTop: 28, display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' },
  arvRange: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 60, fontWeight: 500, color: 'var(--mkt-olive-pale)', lineHeight: 1, letterSpacing: '-0.015em' },
  arvNote: { fontSize: 12.5, color: 'var(--mkt-muted-dark)', marginTop: 18, maxWidth: 560, lineHeight: 1.55 },

  nbhdName: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 54, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.01em', marginTop: 6 },
  nbhdPhotoFrame: { position: 'relative', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: 'var(--mkt-cream-dim)', marginTop: 24 },

  footer: { marginTop: 80, background: 'var(--mkt-dark)', color: 'var(--mkt-text-on-dark)', borderRadius: 18, padding: '44px 40px', textAlign: 'center' },
  footerEyebrow: { fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--mkt-olive-pale)', fontWeight: 600 },
  footerTitle: { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 34, fontWeight: 500, marginTop: 14 },
  footerCta: { display: 'inline-block', marginTop: 24, fontSize: 16, fontWeight: 600, color: '#fff', background: 'var(--mkt-olive)', padding: '14px 26px', borderRadius: 999, textDecoration: 'none', letterSpacing: '0.04em' },
  footerDisc: { marginTop: 32, fontSize: 11.5, color: 'var(--mkt-muted-dark)', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 },
  footerBrand: { marginTop: 24, fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--mkt-muted-dark)', fontWeight: 500 },
}
```

- [ ] **Step 2: Verify the file type-checks**

```bash
npm run lint
```

Expected: no errors in `src/components/listing-pages/ListingPageV2.tsx`. (Lint covers TypeScript via Next.js's eslint config.)

- [ ] **Step 3: Commit**

```bash
git add src/components/listing-pages/ListingPageV2.tsx
git commit -m "$(cat <<'EOF'
Add ListingPageV2 server component

Renders the full v2 listing page from structured inputs (no AI step).
Pulls front/satellite photo URLs from the listing-page-photos bucket
via the admin client. Neighborhood section is opt-in via preset slug
or custom upload; hidden mode skips the section entirely.
EOF
)"
```

---

## Task 5: Branch the public deals route on `style_id`

**Files:**
- Modify: `src/app/deals/html/[slug]/page.tsx`

- [ ] **Step 1: Read the current route**

Open `src/app/deals/html/[slug]/page.tsx`. The file currently selects only `address, html_content` and always renders `HtmlViewerClient`.

- [ ] **Step 2: Update the page to branch on `style_id`**

Replace the contents of the file with:

```tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { HtmlViewerClient } from './viewer-client'
import { ListingPageV2 } from '@/components/listing-pages/ListingPageV2'
import { ListingPageV2Inputs } from '@/lib/validations/listing-page-v2'

export const dynamic = 'force-dynamic'

export default async function DealHtmlPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('listing_pages')
    .select('address, html_content, style_id, inputs')
    .eq('slug', slug)
    .eq('page_type', 'html')
    .eq('is_active', true)
    .single()

  if (error || !data) notFound()

  if (data.style_id === 'listing-page-v2') {
    const parsed = ListingPageV2Inputs.safeParse(data.inputs)
    if (!parsed.success) notFound()
    return <ListingPageV2 inputs={parsed.data} />
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="border-b border-dashed border-neutral-300 pb-3">
        <h1 className="text-base font-medium text-neutral-800">{data.address}</h1>
      </header>
      <HtmlViewerClient html={data.html_content as string} />
    </main>
  )
}
```

- [ ] **Step 3: Verify the route still type-checks**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-test v1 rendering still works**

Start the dev server (or rely on the next task's e2e check). Visit a known v1 slug (look it up by running, in another terminal:

```bash
# Quick way to find an existing v1 slug
grep -rE "listing-page-v1" src 2>/dev/null
```

…or check the marketing-page-creator archive). The v1 page should render exactly as before — the only thing that changed in the route is adding a v2 branch that triggers only when `style_id === 'listing-page-v2'`.

- [ ] **Step 5: Commit**

```bash
git add src/app/deals/html/[slug]/page.tsx
git commit -m "$(cat <<'EOF'
Route deals page by style_id

style_id='listing-page-v2' rows render via the new ListingPageV2
server component reading structured inputs. v1 rows continue to use
HtmlViewerClient with stored html_content. Unknown style_id falls
back to v1 rendering (safe default for the only other current value).
EOF
)"
```

---

## Task 6: Admin form — style picker + v2 conditional fields

**Files:**
- Modify: `src/app/app/marketing-page-creator/create/client.tsx`

This task adds the style picker UI and the v2-specific text fields (city eyebrow, highlights eyebrow, highlight bullets). Photo handling for the neighborhood block + the v2 submit path come in tasks 7 and 8.

- [ ] **Step 1: Make `mapPhoto` conditional on v1**

In `client.tsx`, find the `allRequiredFilled` definition (currently around line 302–306):

```tsx
const allRequiredFilled =
  REQUIRED_FIELDS.every((k) => fields[k].trim() !== "") &&
  frontPhoto.file !== null &&
  satellitePhoto.file !== null &&
  mapPhoto.file !== null;
```

Replace with:

```tsx
const allRequiredFilled =
  REQUIRED_FIELDS.every((k) => fields[k].trim() !== "") &&
  frontPhoto.file !== null &&
  satellitePhoto.file !== null &&
  (styleId === "listing-page-v2" || mapPhoto.file !== null);
```

(Map photo stays required for v1; v2 doesn't use it.)

- [ ] **Step 2: Extend `FormFields` with v2 fields**

Add three new keys to the `FormFields` type at the top of the file (around line 54):

```tsx
type FormFields = {
  address: string;
  subtitle: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  lotSize: string;
  yearBuilt: string;
  zoning: string;
  occupancy: string;
  nearbySalesRange: string;
  countyPageLink: string;
  googleDriveLink: string;
  cityEyebrow: string;
  highlightsEyebrow: string;
  highlightBullets: string;  // newline-separated, parsed on submit
};
```

Update `FIELD_LABELS` to include the new keys (around line 84):

```tsx
const FIELD_LABELS: Record<keyof FormFields, string> = {
  address: "Address",
  subtitle: "Subtitle (optional — leave blank to auto-generate)",
  price: "Price",
  beds: "Beds",
  baths: "Baths",
  sqft: "Sqft",
  lotSize: "Lot Size",
  yearBuilt: "Year Built",
  zoning: "Zoning",
  occupancy: "Occupancy (optional)",
  nearbySalesRange: "ARV Range (e.g. $385K – $420K)",
  countyPageLink: "County Page Link",
  googleDriveLink: "Google Drive Photos Link",
  cityEyebrow: "City Eyebrow (above address — e.g. \"Bremerton, WA\")",
  highlightsEyebrow: "Highlights Section Eyebrow",
  highlightBullets: "Highlight Bullets (one per line, max 8 — optional)",
};
```

Update the initial state to include the new fields (around line 144):

```tsx
const [fields, setFields] = useState<FormFields>({
  address: "",
  subtitle: "",
  price: "",
  beds: "",
  baths: "",
  sqft: "",
  lotSize: "",
  yearBuilt: "",
  zoning: "",
  occupancy: "",
  nearbySalesRange: "",
  countyPageLink: "",
  googleDriveLink: "",
  cityEyebrow: "",
  highlightsEyebrow: "At a Glance",
  highlightBullets: "",
});
```

Update both `prefillFromProperty` (line ~192) and the form-reset block when a lead is cleared (line ~503) to include the new keys:

In `prefillFromProperty`, add these lines inside the `setFields` object:

```tsx
cityEyebrow: property.address ? deriveCityEyebrow(property.address) : "",
highlightsEyebrow: "At a Glance",
highlightBullets: "",
```

In the lead-clear `setFields(...)` reset, add the same three keys with empty/default values.

Add the helper above the component definition (near `parseCityFromAddress`):

```tsx
function deriveCityEyebrow(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const city = parts[1];
  const state = parts[2]?.match(/^([A-Z]{2})/)?.[1] || "WA";
  return city ? `${city}, ${state}` : "";
}
```

In `handlePrefillMock` (around line 268), add the same three fields to the mock object:

```tsx
cityEyebrow: "Tacoma, WA",
highlightsEyebrow: "At a Glance",
highlightBullets: "Big, flat backyard\nDetached garage",
```

- [ ] **Step 3: Default the style picker to v2**

Change the existing line (around line 182):

```tsx
const [styleId, setStyleId] = useState("listing-page-v1");
```

to:

```tsx
const [styleId, setStyleId] = useState("listing-page-v2");
```

- [ ] **Step 4: Surface the style picker in the form UI**

Find the JSX where the form fields are rendered. The form file is long — look for the spot just before the field-list rendering (search for `FIELD_LABELS` usage in JSX). Add this block at the top of the form section, before the address field renders:

```tsx
<section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-2">
  <h3 className="text-sm font-medium text-neutral-700">Style</h3>
  <div className="flex gap-3">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="style"
        value="listing-page-v2"
        checked={styleId === "listing-page-v2"}
        onChange={() => setStyleId("listing-page-v2")}
      />
      <span>v2 (current — editorial)</span>
    </label>
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="style"
        value="listing-page-v1"
        checked={styleId === "listing-page-v1"}
        onChange={() => setStyleId("listing-page-v1")}
      />
      <span>v1 (legacy)</span>
    </label>
  </div>
</section>
```

- [ ] **Step 5: Conditionally hide map photo + render v2 fields**

In the field list rendering, the existing fields stay visible for both styles (they're all relevant). Add the three new v2-only fields right after the existing fields, gated on `styleId === "listing-page-v2"`. Insert this block right after the last existing field input:

```tsx
{styleId === "listing-page-v2" ? (
  <>
    <label className="block text-sm">
      <span className="text-neutral-700">{FIELD_LABELS.cityEyebrow}</span>
      <input
        type="text"
        value={fields.cityEyebrow}
        onChange={(e) => updateField("cityEyebrow", e.target.value)}
        className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
      />
    </label>
    <label className="block text-sm">
      <span className="text-neutral-700">{FIELD_LABELS.highlightsEyebrow}</span>
      <input
        type="text"
        value={fields.highlightsEyebrow}
        onChange={(e) => updateField("highlightsEyebrow", e.target.value)}
        className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
      />
    </label>
    <label className="block text-sm">
      <span className="text-neutral-700">{FIELD_LABELS.highlightBullets}</span>
      <textarea
        rows={4}
        value={fields.highlightBullets}
        onChange={(e) => updateField("highlightBullets", e.target.value)}
        className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
      />
    </label>
  </>
) : null}
```

For the map photo upload slot in the JSX (search for `mapPhoto` / `mapRef` to find the slot), wrap the entire slot rendering in:

```tsx
{styleId === "listing-page-v1" ? (
  /* existing map photo slot JSX */
) : null}
```

- [ ] **Step 6: Verify the form still loads**

```bash
npm run dev
```

Visit `/app/marketing-page-creator/create` and confirm:
- Style picker shows v2 selected by default
- City eyebrow, Highlights eyebrow, and Highlight bullets inputs appear under the v2 style
- The Map Photo upload slot is hidden when v2 is selected, visible when v1 is selected
- Selecting v1 still works as before

- [ ] **Step 7: Commit**

```bash
git add src/app/app/marketing-page-creator/create/client.tsx
git commit -m "$(cat <<'EOF'
Add v2 style picker + v2 form fields to create-listing page

Defaults to v2. v2 surfaces City Eyebrow, Highlights Eyebrow, and
Highlight Bullets fields and hides the (unused) Map Photo upload.
v1 path unchanged.
EOF
)"
```

---

## Task 7: Admin form — neighborhood block (preset / custom / hidden)

**Files:**
- Modify: `src/app/app/marketing-page-creator/create/client.tsx`

- [ ] **Step 1: Add neighborhood state**

In `client.tsx`, add this state declaration near the existing `useState` calls in `CreateListingPageClient` (right after `mapPhoto`'s state):

```tsx
type NeighborhoodMode = "preset" | "custom" | "hidden";
const [neighborhoodMode, setNeighborhoodMode] = useState<NeighborhoodMode>("hidden");
const [neighborhoodPresetSlug, setNeighborhoodPresetSlug] = useState<string>("");
const [neighborhoodLabel, setNeighborhoodLabel] = useState<string>("");
const [neighborhoodPhoto, setNeighborhoodPhoto] = useState<PhotoSlot>({ file: null, preview: "" });
```

- [ ] **Step 2: Import the preset registry**

At the top of `client.tsx`, add:

```tsx
import { NEIGHBORHOOD_PRESETS } from "@/lib/listing-pages/neighborhoods";
```

- [ ] **Step 3: Render the neighborhood picker UI (v2 only)**

In the JSX, add this section right after the highlight-bullets textarea from Task 6, still inside the `styleId === "listing-page-v2"` block:

```tsx
<section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 space-y-3">
  <h3 className="text-sm font-medium text-neutral-700">Neighborhood Section</h3>

  <div className="flex gap-3">
    {(["preset", "custom", "hidden"] as const).map((mode) => (
      <label key={mode} className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="nbhdMode"
          value={mode}
          checked={neighborhoodMode === mode}
          onChange={() => setNeighborhoodMode(mode)}
        />
        <span className="capitalize">{mode}</span>
      </label>
    ))}
  </div>

  {neighborhoodMode === "preset" ? (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="text-neutral-700">Preset</span>
        <select
          value={neighborhoodPresetSlug}
          onChange={(e) => {
            const slug = e.target.value;
            setNeighborhoodPresetSlug(slug);
            const preset = NEIGHBORHOOD_PRESETS.find((p) => p.slug === slug);
            if (preset) setNeighborhoodLabel(preset.label);
          }}
          className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm"
        >
          <option value="">Choose a neighborhood…</option>
          {NEIGHBORHOOD_PRESETS.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label} — {p.region}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700">Display label (override)</span>
        <input
          type="text"
          value={neighborhoodLabel}
          onChange={(e) => setNeighborhoodLabel(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
        />
      </label>
      <p className="text-xs text-neutral-500">
        Preset photo will load from <code>/marketing/neighborhoods/{neighborhoodPresetSlug || "&lt;slug&gt;"}.jpg</code>.
        If the photo doesn&apos;t exist yet, switch to Custom and upload one for now.
      </p>
    </div>
  ) : null}

  {neighborhoodMode === "custom" ? (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="text-neutral-700">Display label</span>
        <input
          type="text"
          value={neighborhoodLabel}
          onChange={(e) => setNeighborhoodLabel(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-editable"
          placeholder="e.g. Bremerton"
        />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-700">Neighborhood photo (16:9 looks best)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handlePhotoSelect(e, setNeighborhoodPhoto)}
          className="mt-1 block w-full text-sm"
        />
      </label>
      {neighborhoodPhoto.preview ? (
        <img src={neighborhoodPhoto.preview} alt="Neighborhood preview" className="rounded border max-h-48" />
      ) : null}
    </div>
  ) : null}

  {neighborhoodMode === "hidden" ? (
    <p className="text-xs text-neutral-500">The Neighborhood section will not appear on the listing page.</p>
  ) : null}
</section>
```

- [ ] **Step 4: Update `allRequiredFilled` to validate the neighborhood block when v2**

Replace the `allRequiredFilled` block (which already changed in Task 6) with:

```tsx
const neighborhoodFilled =
  neighborhoodMode === "hidden" ||
  (neighborhoodMode === "preset" && neighborhoodPresetSlug && neighborhoodLabel) ||
  (neighborhoodMode === "custom" && neighborhoodPhoto.file && neighborhoodLabel);

const allRequiredFilled =
  REQUIRED_FIELDS.every((k) => fields[k].trim() !== "") &&
  frontPhoto.file !== null &&
  satellitePhoto.file !== null &&
  (styleId === "listing-page-v2"
    ? !!neighborhoodFilled
    : mapPhoto.file !== null);
```

- [ ] **Step 5: Verify**

```bash
npm run dev
```

Open the form, toggle between Preset / Custom / Hidden, and confirm:
- Preset reveals the dropdown + label override
- Custom reveals the label input + file picker + preview
- Hidden reveals the "section won't appear" hint
- The Generate button stays disabled until neighborhood requirements are met

- [ ] **Step 6: Commit**

```bash
git add src/app/app/marketing-page-creator/create/client.tsx
git commit -m "$(cat <<'EOF'
Add neighborhood picker to v2 create-listing form

Three modes — preset slug from the WA registry, custom photo upload,
or hidden. Submit gating enforces the right field combinations per
mode.
EOF
)"
```

---

## Task 8: Admin form — v2 submit path (skip OpenAI, write structured inputs)

**Files:**
- Modify: `src/app/app/marketing-page-creator/create/client.tsx`

- [ ] **Step 1: Add a v2 submit handler**

In `client.tsx`, find `handleGenerate` (around line 330). Refactor by adding a sibling helper `handleGenerateV2` and routing based on style. Add this function next to `handleGenerate`:

```tsx
async function handleGenerateV2(pageType: "webpage" | "html") {
  const city = parseCityFromAddress(fields.address);
  setGenerating(true);
  setError("");
  setGenStep("uploading");

  try {
    const listingPageId = crypto.randomUUID();

    const uploads: Promise<{ key: string; path: string }>[] = [
      uploadPhotoReturningPath(listingPageId, "front", frontPhoto.file!).then((path) => ({ key: "frontPhotoPath", path })),
      uploadPhotoReturningPath(listingPageId, "satellite", satellitePhoto.file!).then((path) => ({ key: "satellitePhotoPath", path })),
    ];
    if (neighborhoodMode === "custom" && neighborhoodPhoto.file) {
      uploads.push(
        uploadPhotoReturningPath(listingPageId, "neighborhood", neighborhoodPhoto.file).then((path) => ({ key: "neighborhoodPhotoPath", path })),
      );
    }
    const uploaded = await Promise.all(uploads);
    const photoPaths = Object.fromEntries(uploaded.map((u) => [u.key, u.path]));

    const bullets = fields.highlightBullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 8);

    const neighborhood =
      neighborhoodMode === "hidden"
        ? { mode: "hidden" as const }
        : neighborhoodMode === "preset"
          ? { mode: "preset" as const, slug: neighborhoodPresetSlug, label: neighborhoodLabel }
          : { mode: "custom" as const, photoPath: photoPaths.neighborhoodPhotoPath, label: neighborhoodLabel };

    const v2Inputs = {
      address: fields.address,
      price: fields.price,
      beds: Number(fields.beds),
      baths: Number(fields.baths),
      sqft: Number(fields.sqft),
      lotSize: fields.lotSize,
      yearBuilt: Number(fields.yearBuilt),
      zoning: fields.zoning,
      occupancy: fields.occupancy || undefined,
      arvRange: fields.nearbySalesRange,
      countyPageLink: fields.countyPageLink,
      googleDriveLink: fields.googleDriveLink,
      frontPhotoPath: photoPaths.frontPhotoPath,
      satellitePhotoPath: photoPaths.satellitePhotoPath,
      customSubtitle: fields.subtitle.trim() || undefined,
      cityEyebrow: fields.cityEyebrow,
      highlightsEyebrow: fields.highlightsEyebrow || "At a Glance",
      highlightBullets: bullets.length ? bullets : undefined,
      neighborhood,
    };

    setGenStep("saving");
    const saveResult = await createListingPage({
      id: listingPageId,
      lead_id: selectedLeadId || null,
      property_id: leadData?.properties[selectedPropertyIdx]?.id || null,
      address: fields.address,
      price: fields.price,
      city,
      page_type: pageType,
      style_id: "listing-page-v2",
      html_content: "",
      inputs: v2Inputs,
    });

    if (!saveResult.success) {
      setError("Could not save: " + saveResult.error);
      setGenStep("error");
      return;
    }

    setResultSlug(saveResult.data.slug);
    setGenStep("done");
  } catch (e) {
    setError((e as Error).message);
    setGenStep("error");
  } finally {
    setGenerating(false);
  }
}
```

- [ ] **Step 2: Add the `uploadPhotoReturningPath` helper**

`uploadPhoto` currently returns the public URL. v2 stores the storage path (not the URL). Add this sibling helper next to `uploadPhoto`:

```tsx
async function uploadPhotoReturningPath(
  listingPageId: string,
  fileName: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const storageName = `${fileName}.${ext}`;
  const urlResult = await getListingPageUploadUrl(listingPageId, storageName);
  if (!urlResult.success) throw new Error(urlResult.error);

  const uploadRes = await fetch(urlResult.data.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!uploadRes.ok) throw new Error("Photo upload failed");
  return urlResult.data.path;
}
```

- [ ] **Step 3: Route from the existing Generate-click handler**

Find the JSX where `handleGenerate("html")` is invoked. Wrap that call so v2 dispatches to `handleGenerateV2`:

```tsx
onClick={() =>
  styleId === "listing-page-v2"
    ? handleGenerateV2("html")
    : handleGenerate("html")
}
```

Repeat for any `handleGenerate("webpage")` invocation in the JSX.

- [ ] **Step 4: Manual end-to-end smoke test**

```bash
npm run dev
```

- Open `/app/marketing-page-creator/create`
- Click the dev "Pre-fill mock data" button to populate v1 fields
- Fill in the v2 fields manually: `City Eyebrow = "Tacoma, WA"`, leave `Highlights Eyebrow` as "At a Glance", add 1-2 highlight bullets
- Set Neighborhood = Custom, label "Tacoma", upload any image
- Click Generate
- After success, click through to the deal URL — confirm the v2 page renders correctly (hero, photos, text-us band, highlights, links, ARV dark band, neighborhood section, footer)

- [ ] **Step 5: Commit**

```bash
git add src/app/app/marketing-page-creator/create/client.tsx
git commit -m "$(cat <<'EOF'
Wire v2 submit path: skip OpenAI, save structured inputs

v2 generates listings without calling /api/listing-pages/generate.
Photos upload to the listing-page-photos bucket; the row stores the
storage paths inside inputs JSONB. v1 path is unchanged.
EOF
)"
```

---

## Task 9: Verification + cleanup

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (including the two new suites from Tasks 1 and 2 and the existing slug tests).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: clean. Fix any errors before proceeding.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: clean build. This is the strongest smoke test that everything type-checks and the routes are correctly registered.

- [ ] **Step 4: Visual diff against the locked mockup**

```bash
npm run dev
```

Open both URLs side by side in the browser:
- Mockup: `http://localhost:60335` (visual companion server, showing `full-page-v3.html`)
- Live: a v2 deal URL from your local test row

Compare section-by-section. Acceptable drift: minor spacing or rounding differences from inline-style vs. raw CSS. Unacceptable drift: any structural change (missing section, wrong font, wrong color, missing photo). If you spot unacceptable drift, fix `ListingPageV2.tsx` and re-test.

- [ ] **Step 5: Stop the visual companion server**

```bash
/Users/groovehouseent/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/scripts/stop-server.sh "/Users/groovehouseent/Desktop/Bt Investments App Development/bt-investments/.superpowers/brainstorm/600-1779761984"
```

This frees the port and writes a `server-stopped` marker. The mockup files in `.superpowers/brainstorm/` stay on disk for later reference.

- [ ] **Step 6: Final commit (if any fixes were needed)**

If you made tweaks during the visual diff:

```bash
git add -p   # review each change
git commit -m "Polish v2 listing page after visual diff"
```

Otherwise skip this step.

---

## Self-Review Notes

The following spec sections map to the tasks above:

| Spec section | Task |
|---|---|
| Page anatomy (nav → footer) | Task 4 |
| What's removed/renamed vs v1 | Tasks 4, 6 |
| Render-from-data architecture | Tasks 4, 5 |
| Data model (Zod schema, JSONB inputs) | Task 2 |
| Neighborhood preset library + cold-start | Tasks 1, 7 |
| Admin form changes (style picker, fields, neighborhood block) | Tasks 6, 7 |
| Routing & rendering branch | Task 5 |
| Migration plan (no DB changes) | Implicit — no migration tasks needed |
| CSS token addition (`--mkt-olive-pale`) | Task 3 |
| Open question: `html_content` NOT NULL constraint | Resolved — v2 inserts empty string (Task 8) |

Out-of-scope items (animations, editing, live ARV computation, `/deals` index page) intentionally have no tasks.
