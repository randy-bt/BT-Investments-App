# Marketing Page Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a module that generates HTML marketing one-pagers for properties, replacing the manual prompt-filling workflow.

**Architecture:** Two new pages (module index + create form) backed by a `listing_pages` table in Supabase. Photos upload to Supabase Storage. GPT-4o generates the HTML from a prompt with all data pre-filled. Zoning field added to the property scraper and PropertyCard.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Storage), OpenAI GPT-4o, Zod validation, React Server Components + Client Components.

---

### Task 1: Add zoning column to properties

**Files:**
- Create: `supabase/migrations/032_zoning.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/validations/properties.ts`

- [ ] **Step 1: Create migration file**

```sql
-- 032_zoning.sql
ALTER TABLE properties ADD COLUMN zoning TEXT;
```

- [ ] **Step 2: Add zoning to Property type**

In `src/lib/types.ts`, add `zoning: string | null` to the `Property` type after the `county` field:

```typescript
export type Property = {
  id: string
  lead_id: string
  address: string
  apn: string | null
  county: string | null
  zoning: string | null  // <-- add this line
  legal_description: string | null
  // ... rest unchanged
}
```

- [ ] **Step 3: Add zoning to validation schemas**

In `src/lib/validations/properties.ts`:

Add to `addPropertySchema` after `county`:
```typescript
zoning: z.string().optional(),
```

Add to `updatePropertySchema` after `county`:
```typescript
zoning: z.string().nullish(),
```

- [ ] **Step 4: Run the migration against Supabase**

```bash
npx supabase db push
```

Or apply manually via Supabase dashboard SQL editor.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/032_zoning.sql src/lib/types.ts src/lib/validations/properties.ts
git commit -m "Add zoning column to properties table"
```

---

### Task 2: Add zoning to scraper and PropertyCard

**Files:**
- Modify: `src/lib/scraper.ts`
- Modify: `src/components/PropertyCard.tsx`

- [ ] **Step 1: Add zoning to ScrapedPropertyData type**

In `src/lib/scraper.ts`, add to the `ScrapedPropertyData` type:

```typescript
export type ScrapedPropertyData = {
  redfin_value?: number
  zillow_value?: number
  county_value?: number
  apn?: string
  county?: string
  zoning?: string  // <-- add this line
  legal_description?: string
  // ... rest unchanged
}
```

- [ ] **Step 2: Extract zoning from Pellego API**

In `scrapePellego()`, after `if (s.property_type) result.property_type = s.property_type`, add:

```typescript
if (p.zoning) result.zoning = p.zoning
else if (p.zoning_code) result.zoning = p.zoning_code
```

- [ ] **Step 3: Add zoning to PropertyCard field grid**

In `src/components/PropertyCard.tsx`, add to `rightFields` array (before `"Redfin Value"`):

```typescript
const rightFields: FieldDef[] = [
  { label: "Sqft", key: "sqft", type: "number" },
  { label: "Lot Size", key: "lot_size", type: "text" },
  { label: "Owner Address", key: "owner_mailing_address", type: "text" },
  { label: "Zoning", key: "zoning", type: "text" },  // <-- add this line
  { label: "Redfin Value", key: "redfin_value", type: "number" },
  { label: "Zillow Value", key: "zillow_value", type: "number" },
  { label: "County Value", key: "county_value", type: "number" },
];
```

This keeps zoning in the two-column grid. Legal description stays full-width below.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraper.ts src/components/PropertyCard.tsx
git commit -m "Add zoning to property scraper and PropertyCard"
```

---

### Task 3: Create listing_pages database table

**Files:**
- Create: `supabase/migrations/033_listing_pages.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 033_listing_pages.sql
CREATE TABLE listing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  price TEXT NOT NULL,
  html_content TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listing_pages_created_at_idx ON listing_pages(created_at DESC);

ALTER TABLE listing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage listing pages"
  ON listing_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Add ListingPage type**

In `src/lib/types.ts`, add at the end (before the closing of the file):

```typescript
export type ListingPage = {
  id: string
  lead_id: string | null
  property_id: string | null
  address: string
  price: string
  html_content: string
  inputs: Record<string, unknown>
  is_active: boolean
  created_by: string
  created_at: string
}
```

- [ ] **Step 3: Run the migration**

```bash
npx supabase db push
```

Or apply manually via Supabase dashboard SQL editor.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/033_listing_pages.sql src/lib/types.ts
git commit -m "Add listing_pages table and type"
```

---

### Task 4: Create listing page prompt and template

**Files:**
- Create: `src/lib/prompts/listing-page.ts`

- [ ] **Step 1: Create the prompt file**

This file exports the HTML template as a constant and a function that assembles the full prompt with provided data.

```typescript
// src/lib/prompts/listing-page.ts

export type ListingPageInputs = {
  address: string
  price: string
  beds: number
  baths: number
  sqft: number
  lotSize: string
  yearBuilt: number
  zoning: string
  occupancy: string
  nearbySalesRange: string
  countyPageLink: string
  googleDriveLink: string
  frontPhotoUrl: string
  satellitePhotoUrl: string
  mapPhotoUrl: string
}

const HTML_TEMPLATE = `<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ADDRESS}} — One-Page Investor Flyer</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --fg:#111827; --muted:#6b7280; --accent:#0ea5e9; --line:#e5e7eb;
    --soft-yellow:#fffbeb; --soft-yellow-border:#fde68a;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;color:var(--fg)}
  .wrap{max-width:900px;margin:20px auto 28px;padding:0 18px}
  header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
  h1{margin:0;font-size:26px;line-height:1.15}
  .sub{margin:6px 0 0;color:var(--muted);font-size:14px}
  .price{font-size:22px;font-weight:700;color:#6e8439;text-align:right}
  .mini{color:var(--muted);font-size:13px;text-align:right}
  .card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
  .card h2{margin:4px 0 8px;font-size:15px}
  .pills{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}
  .pill{border:1px solid var(--line);background:#f8fafc;border-radius:999px;padding:6px 10px;font-size:13px}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  ul{margin:0;padding-left:18px}
  li{margin:6px 0}
  .cta{display:inline-block;margin:10px 0 0;padding:8px 12px;border:1px solid #6e8439;border-radius:10px;background:#6e8439;color:#ffffff;text-decoration:none;font-size:13px}
  footer{margin-top:10px;color:var(--muted);font-size:12px}
  @media (max-width:760px){.grid-2{grid-template-columns:1fr} .price,.mini{text-align:left} }
  @page{size:Letter;margin:0.5in}
  section,header,footer{page-break-inside:avoid}
  .frame-5x4{border:1px solid var(--line);border-radius:10px;overflow:hidden;aspect-ratio:5/4;background:#f8fafc}
  .ph-img{width:100%;height:100%;object-fit:cover;display:block}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>{{ADDRESS}}</h1>
        <p class="sub">{{SUBTITLE}}</p>
      </div>
      <div>
        <div class="price">{{PRICE}}</div>
        <div class="mini">EMD: $10,000 • Close: ASAP</div>
      </div>
    </header>

    <section class="card">
      <h2>Property Highlights</h2>
      <div class="pills">
        {{PILLS}}
      </div>
      <div class="grid-2">
        <div class="frame-5x4">
          <img class="ph-img" src="{{FRONT_PHOTO}}" alt="Front Photo">
        </div>
        <div class="frame-5x4">
          <img class="ph-img" src="{{SATELLITE_PHOTO}}" alt="Satellite / Lot">
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Terms</h2>
      <ul>
        <li>Purchase Price: <strong>{{PRICE}}</strong></li>
        <li>EMD: <strong>$10,000</strong></li>
        <li>Close: <strong>ASAP</strong></li>
        <li><strong>As-Is</strong>; buyer responsible for compliance after closing</li>
      </ul>
    </section>

    <a class="cta" href="{{COUNTY_PAGE_LINK}}" target="_blank" rel="noopener">County Page</a>

    <a class="cta" href="{{GOOGLE_DRIVE_LINK}}" target="_blank" rel="noopener">Photos and more info (Google Drive)</a>

    <section class="card" style="margin-top:12px">
      <h2>Nearby Sales (last ~3 months)</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <div class="pill">{{NEARBY_SALES_RANGE}}</div>
      </div>
    </section>

    <section class="card" style="margin-top:12px">
      <h2>Area Map</h2>
      <div class="frame-5x4">
        <img class="ph-img" src="{{MAP_PHOTO}}" alt="Area Map">
      </div>
    </section>

    <footer>
      Buyer to verify all information, zoning/uses, and compliance requirements with the City.
      <br>Contact: Randy — BT Investments LLC — via text (425) 971-2331
    </footer>
  </div>
</body>
</html>`

export function buildListingPagePrompt(inputs: ListingPageInputs): string {
  const occupancyLine = inputs.occupancy
    ? `- Occupancy/Access: ${inputs.occupancy}`
    : '- Occupancy/Access: Not specified (omit from notable features)'

  return `You are producing a completed HTML one-pager for a real estate investment property marketing flyer.

All property data is provided below — do NOT search the web. Your job is to:
1. Write a SUBTITLE: one factual sentence highlighting the key facts (no fluff). Example: "Discounted off-market 3/1 on 6,970 sf lot."
2. Write NOTABLE FEATURES as pill items: the known property facts (beds/baths, sqft, lot size, year built, zoning) plus 1-3 short, neutral descriptive bullets if appropriate (e.g., "Big, flat backyard" — only if inferable from the facts). Each pill is a \`<div class="pill">...</div>\`. Include only pills you can confidently fill — no empty or placeholder pills.
3. Fill in the HTML template below with all provided values and your generated subtitle/pills.

Return ONLY the final HTML. No commentary, no code fences, no explanation.

---

## Property Data (use these exactly)

- Address: ${inputs.address}
- Price: ${inputs.price}
- Beds/Baths: ${inputs.beds} bed / ${inputs.baths} bath
- Square Footage: ${inputs.sqft.toLocaleString()} sf
- Lot Size: ${inputs.lotSize}
- Year Built: ${inputs.yearBuilt}
- Zoning: ${inputs.zoning} (buyer to verify)
${occupancyLine}
- Nearby Sales Range: ${inputs.nearbySalesRange}
- County Page Link: ${inputs.countyPageLink}
- Google Drive Photos Link: ${inputs.googleDriveLink}
- Front Photo URL: ${inputs.frontPhotoUrl}
- Satellite Photo URL: ${inputs.satellitePhotoUrl}
- Map Photo URL: ${inputs.mapPhotoUrl}

## Static (do not change)
- EMD: $10,000
- Close: ASAP
- Condition: As-Is; buyer responsible for compliance after closing
- Footer text and overall styling remain exactly as in the template.

## HTML Template

Replace the {{PLACEHOLDER}} tokens with real values. For {{PILLS}}, generate the appropriate \`<div class="pill">...</div>\` elements. For {{SUBTITLE}}, write your one-sentence subtitle.

${HTML_TEMPLATE}`
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompts/listing-page.ts
git commit -m "Add listing page prompt and HTML template"
```

---

### Task 5: Create listing pages server actions

**Files:**
- Create: `src/actions/listing-pages.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
// src/actions/listing-pages.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, ListingPage } from '@/lib/types'

export async function getListingPages(): Promise<ActionResult<ListingPage[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleListingPageActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getListingPageUploadUrl(
  listingPageId: string,
  fileName: string
): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const path = `listing-pages/${listingPageId}/${fileName}`
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('attachments')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }
    return { success: true, data: { path, signedUrl: data.signedUrl } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getListingPagePhotoUrl(
  storagePath: string
): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const admin = createAdminClient()
    const { data } = admin.storage
      .from('attachments')
      .getPublicUrl(storagePath)

    return { success: true, data: data.publicUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createListingPage(input: {
  id: string
  lead_id: string | null
  property_id: string | null
  address: string
  price: string
  html_content: string
  inputs: Record<string, unknown>
}): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .insert({
        id: input.id,
        lead_id: input.lead_id,
        property_id: input.property_id,
        address: input.address,
        price: input.price,
        html_content: input.html_content,
        inputs: input.inputs,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/listing-pages.ts
git commit -m "Add listing pages server actions"
```

---

### Task 6: Create the API route for HTML generation

**Files:**
- Create: `src/app/api/listing-pages/generate/route.ts`

- [ ] **Step 1: Create the API route**

This is an API route (not a server action) because OpenAI calls can take time and we want proper streaming/timeout control.

```typescript
// src/app/api/listing-pages/generate/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import OpenAI from 'openai'
import { buildListingPagePrompt, type ListingPageInputs } from '@/lib/prompts/listing-page'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as ListingPageInputs

    // Validate all required fields are present
    const required: (keyof ListingPageInputs)[] = [
      'address', 'price', 'beds', 'baths', 'sqft', 'lotSize',
      'yearBuilt', 'zoning', 'nearbySalesRange', 'countyPageLink',
      'googleDriveLink', 'frontPhotoUrl', 'satellitePhotoUrl', 'mapPhotoUrl',
    ]
    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const prompt = buildListingPagePrompt(body)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const html = response.choices[0]?.message?.content?.trim() ?? ''

    if (!html) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
    }

    // Strip markdown code fences if the AI wraps the response
    const cleanHtml = html
      .replace(/^```html?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    return NextResponse.json({ success: true, html: cleanHtml })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/listing-pages/generate/route.ts
git commit -m "Add listing page HTML generation API route"
```

---

### Task 7: Build the module index page (history table)

**Files:**
- Modify: `src/app/app/marketing-page-creator/page.tsx`
- Create: `src/app/app/marketing-page-creator/client.tsx`

- [ ] **Step 1: Create the client component**

```typescript
// src/app/app/marketing-page-creator/client.tsx
"use client";

import { useState, useTransition } from "react";
import { toggleListingPageActive } from "@/actions/listing-pages";
import type { ListingPage } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ListingPagesTable({
  initialPages,
}: {
  initialPages: ListingPage[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, currentValue: boolean) {
    startTransition(async () => {
      const result = await toggleListingPageActive(id, !currentValue);
      if (result.success) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, is_active: result.data.is_active } : p
          )
        );
      }
    });
  }

  async function handleCopy(html: string, id: string) {
    await navigator.clipboard.writeText(html);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (pages.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-4">
        No marketing pages created yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-dashed divide-neutral-200">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-3 py-2 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider">
        <span>Address</span>
        <span>Price</span>
        <span>Created</span>
        <span className="text-right">Status</span>
      </div>

      {pages.map((page) => (
        <div key={page.id}>
          {/* Row */}
          <div
            className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-3 py-2.5 items-center cursor-pointer hover:bg-neutral-50 transition-colors"
            onClick={() =>
              setExpandedId(expandedId === page.id ? null : page.id)
            }
          >
            <span className="text-sm font-editable truncate">
              {page.address}
            </span>
            <span className="text-sm text-neutral-600">{page.price}</span>
            <span className="text-xs text-neutral-500">
              {formatDate(page.created_at)}
            </span>
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggle(page.id, page.is_active)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  page.is_active ? "bg-[#6e8439]" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    page.is_active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expanded HTML view */}
          {expandedId === page.id && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[0.65rem] text-neutral-400 uppercase tracking-wider">
                    HTML Output
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(page.html_content, page.id)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-white transition-colors"
                  >
                    {copied === page.id ? "Copied!" : "Copy HTML"}
                  </button>
                </div>
                <pre className="text-xs text-neutral-600 font-editable whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                  {page.html_content}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace the placeholder page**

```typescript
// src/app/app/marketing-page-creator/page.tsx
import Link from "next/link";
import { getListingPages } from "@/actions/listing-pages";
import { ListingPagesTable } from "./client";

export default async function MarketingPageCreatorPage() {
  const result = await getListingPages();
  const pages = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Marketing Page Creator
          </h1>
          <p className="text-sm text-neutral-600">
            Generate one-page marketing flyers for properties
          </p>
        </div>
        <Link
          href="/app/marketing-page-creator/create"
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
        >
          + Create New Page
        </Link>
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
        <ListingPagesTable initialPages={pages} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/marketing-page-creator/page.tsx src/app/app/marketing-page-creator/client.tsx
git commit -m "Build marketing page creator index with history table"
```

---

### Task 8: Build the create form page

**Files:**
- Create: `src/app/app/marketing-page-creator/create/page.tsx`
- Create: `src/app/app/marketing-page-creator/create/client.tsx`

- [ ] **Step 1: Create the server page**

```typescript
// src/app/app/marketing-page-creator/create/page.tsx
import { AppBackLink } from "@/components/AppBackLink";
import { getLeads } from "@/actions/leads";
import { CreateListingPageClient } from "./client";

export default async function CreateListingPage() {
  // Load all active leads for the selector
  const result = await getLeads({ page: 1, pageSize: 500, status: "active" });
  const leads = result.success ? result.data.items : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Create Marketing Page
          </h1>
          <p className="text-sm text-neutral-600">
            Fill in the details and generate the HTML
          </p>
        </div>
        <AppBackLink href="/app/marketing-page-creator" />
      </header>

      <CreateListingPageClient leads={leads} />
    </main>
  );
}
```

- [ ] **Step 2: Create the client component**

This is the largest component. It handles lead/property selection, form state, photo uploads, validation, and generation.

```typescript
// src/app/app/marketing-page-creator/create/client.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLead } from "@/actions/leads";
import {
  getListingPageUploadUrl,
  getListingPagePhotoUrl,
  createListingPage,
} from "@/actions/listing-pages";
import type { LeadWithAddress, LeadWithRelations, Property } from "@/lib/types";

// County assessor URLs — same map as PropertyCard
const COUNTY_URLS: Record<string, string> = {
  king: "https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s",
  pierce: "https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary",
  snohomish: "https://www.snoco.org/proptax/search.aspx?parcel_number=%s",
  thurston: "https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s",
  kitsap: "https://psearch.kitsapgov.com/details.asp?RPID=%s",
  skagit: "https://www.skagitcounty.net/Search/Property/?id=%s",
};

function buildCountyUrl(county: string | null, apn: string | null): string {
  if (!county || !apn) return "";
  const template = COUNTY_URLS[county.toLowerCase()];
  if (!template) return "";
  return template.replace("%s", apn);
}

type PhotoSlot = {
  file: File | null;
  preview: string;
};

type FormFields = {
  address: string;
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
};

const REQUIRED_FIELDS: (keyof FormFields)[] = [
  "address",
  "price",
  "beds",
  "baths",
  "sqft",
  "lotSize",
  "yearBuilt",
  "zoning",
  "nearbySalesRange",
  "countyPageLink",
  "googleDriveLink",
];

const FIELD_LABELS: Record<keyof FormFields, string> = {
  address: "Address",
  price: "Price",
  beds: "Beds",
  baths: "Baths",
  sqft: "Sqft",
  lotSize: "Lot Size",
  yearBuilt: "Year Built",
  zoning: "Zoning",
  occupancy: "Occupancy (optional)",
  nearbySalesRange: "Nearby Sales Range",
  countyPageLink: "County Page Link",
  googleDriveLink: "Google Drive Photos Link",
};

export function CreateListingPageClient({
  leads,
}: {
  leads: LeadWithAddress[];
}) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [leadData, setLeadData] = useState<LeadWithRelations | null>(null);
  const [selectedPropertyIdx, setSelectedPropertyIdx] = useState(0);
  const [loadingLead, setLoadingLead] = useState(false);

  const [fields, setFields] = useState<FormFields>({
    address: "",
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
  });

  const [frontPhoto, setFrontPhoto] = useState<PhotoSlot>({ file: null, preview: "" });
  const [satellitePhoto, setSatellitePhoto] = useState<PhotoSlot>({ file: null, preview: "" });
  const [mapPhoto, setMapPhoto] = useState<PhotoSlot>({ file: null, preview: "" });

  const frontRef = useRef<HTMLInputElement>(null);
  const satRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);

  const [generating, setGenerating] = useState(false);
  const [resultHtml, setResultHtml] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");

  function updateField(key: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function prefillFromProperty(property: Property, lead: LeadWithRelations) {
    setFields({
      address: property.address || "",
      price: lead.asking_price || "",
      beds: property.bedrooms?.toString() || "",
      baths: property.bathrooms?.toString() || "",
      sqft: property.sqft?.toString() || "",
      lotSize: property.lot_size || "",
      yearBuilt: property.year_built?.toString() || "",
      zoning: (property as Property & { zoning?: string }).zoning || "",
      occupancy: lead.occupancy_status || "",
      nearbySalesRange: "",
      countyPageLink: buildCountyUrl(property.county, property.apn),
      googleDriveLink: "",
    });
  }

  async function handleSelectLead(leadId: string) {
    setSelectedLeadId(leadId);
    if (!leadId) {
      setLeadData(null);
      return;
    }

    setLoadingLead(true);
    const result = await getLead(leadId);
    setLoadingLead(false);

    if (result.success) {
      setLeadData(result.data);
      setSelectedPropertyIdx(0);
      if (result.data.properties.length > 0) {
        prefillFromProperty(result.data.properties[0], result.data);
      }
    }
  }

  function handleSelectProperty(idx: number) {
    setSelectedPropertyIdx(idx);
    if (leadData && leadData.properties[idx]) {
      prefillFromProperty(leadData.properties[idx], leadData);
    }
  }

  function handlePhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: PhotoSlot) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, preview: URL.createObjectURL(file) });
    e.target.value = "";
  }

  const allRequiredFilled =
    REQUIRED_FIELDS.every((k) => fields[k].trim() !== "") &&
    frontPhoto.file !== null &&
    satellitePhoto.file !== null &&
    mapPhoto.file !== null;

  async function uploadPhoto(
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

    const publicResult = await getListingPagePhotoUrl(urlResult.data.path);
    if (!publicResult.success) throw new Error(publicResult.error);
    return publicResult.data;
  }

  async function handleGenerate() {
    if (!allRequiredFilled) return;

    setGenerating(true);
    setError("");
    setResultHtml("");

    try {
      // Generate a UUID for the listing page record
      const listingPageId = crypto.randomUUID();

      // Upload photos in parallel
      const [frontUrl, satUrl, mapUrl] = await Promise.all([
        uploadPhoto(listingPageId, "front", frontPhoto.file!),
        uploadPhoto(listingPageId, "satellite", satellitePhoto.file!),
        uploadPhoto(listingPageId, "map", mapPhoto.file!),
      ]);

      // Call the generation API
      const res = await fetch("/api/listing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: fields.address,
          price: fields.price,
          beds: Number(fields.beds),
          baths: Number(fields.baths),
          sqft: Number(fields.sqft),
          lotSize: fields.lotSize,
          yearBuilt: Number(fields.yearBuilt),
          zoning: fields.zoning,
          occupancy: fields.occupancy || "",
          nearbySalesRange: fields.nearbySalesRange,
          countyPageLink: fields.countyPageLink,
          googleDriveLink: fields.googleDriveLink,
          frontPhotoUrl: frontUrl,
          satellitePhotoUrl: satUrl,
          mapPhotoUrl: mapUrl,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Generation failed");
        return;
      }

      // Save to database
      const saveResult = await createListingPage({
        id: listingPageId,
        lead_id: selectedLeadId || null,
        property_id: leadData?.properties[selectedPropertyIdx]?.id || null,
        address: fields.address,
        price: fields.price,
        html_content: json.html,
        inputs: fields as unknown as Record<string, unknown>,
      });

      if (!saveResult.success) {
        setError("HTML generated but could not save: " + saveResult.error);
        setResultHtml(json.html);
        return;
      }

      setResultHtml(json.html);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resultHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredLeads = leadSearch
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
          (l.address && l.address.toLowerCase().includes(leadSearch.toLowerCase()))
      )
    : leads;

  function isFieldEmpty(key: keyof FormFields) {
    return REQUIRED_FIELDS.includes(key) && fields[key].trim() === "";
  }

  // If we already have a result, show it
  if (resultHtml) {
    return (
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-medium text-neutral-700">
            Generated HTML
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50"
            >
              {copied ? "Copied!" : "Copy HTML"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/marketing-page-creator")}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1 text-xs hover:bg-[#dce3cb]"
            >
              Done
            </button>
          </div>
        </div>
        <pre className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 font-editable whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
          {resultHtml}
        </pre>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Lead & Property Selection */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Select Lead
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Search leads by name or address..."
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm font-editable"
          />
          {leadSearch && !selectedLeadId && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg">
              {filteredLeads.length === 0 ? (
                <div className="px-3 py-2 text-xs text-neutral-400">
                  No leads found
                </div>
              ) : (
                filteredLeads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setLeadSearch(lead.name);
                      handleSelectLead(lead.id);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                  >
                    <span className="font-medium">{lead.name}</span>
                    {lead.address && (
                      <span className="text-neutral-400 ml-2 text-xs">
                        {lead.address}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedLeadId && (
          <button
            type="button"
            onClick={() => {
              setSelectedLeadId("");
              setLeadData(null);
              setLeadSearch("");
              setFields({
                address: "", price: "", beds: "", baths: "", sqft: "",
                lotSize: "", yearBuilt: "", zoning: "", occupancy: "",
                nearbySalesRange: "", countyPageLink: "", googleDriveLink: "",
              });
            }}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Clear selection
          </button>
        )}

        {loadingLead && (
          <p className="text-xs text-neutral-400 animate-pulse">
            Loading lead data...
          </p>
        )}

        {/* Property selector (if lead has multiple) */}
        {leadData && leadData.properties.length > 1 && (
          <div className="space-y-1">
            <span className="text-xs text-neutral-500">Select Property</span>
            <div className="flex gap-2">
              {leadData.properties.map((prop, idx) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => handleSelectProperty(idx)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    idx === selectedPropertyIdx
                      ? "border-neutral-800 bg-neutral-800 text-white"
                      : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {prop.address || `Property ${idx + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Property Details Form */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">
          Property Details
        </h3>

        {/* Address & Price */}
        <div className="grid gap-3 md:grid-cols-2">
          {(["address", "price"] as const).map((key) => (
            <label key={key} className="block">
              <span className="text-xs text-neutral-500">
                {FIELD_LABELS[key]}
              </span>
              <input
                value={fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
                  isFieldEmpty(key)
                    ? "border-red-300 bg-red-50"
                    : "border-neutral-300"
                }`}
              />
            </label>
          ))}
        </div>

        {/* Property specs */}
        <div className="grid gap-3 md:grid-cols-3">
          {(["beds", "baths", "sqft", "lotSize", "yearBuilt", "zoning"] as const).map(
            (key) => (
              <label key={key} className="block">
                <span className="text-xs text-neutral-500">
                  {FIELD_LABELS[key]}
                </span>
                <input
                  value={fields[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
                    isFieldEmpty(key)
                      ? "border-red-300 bg-red-50"
                      : "border-neutral-300"
                  }`}
                />
              </label>
            )
          )}
        </div>

        {/* Occupancy */}
        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.occupancy}
          </span>
          <input
            value={fields.occupancy}
            onChange={(e) => updateField("occupancy", e.target.value)}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
          />
        </label>
      </section>

      {/* Links & Sales */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">
          Links & Nearby Sales
        </h3>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.nearbySalesRange}
          </span>
          <input
            value={fields.nearbySalesRange}
            onChange={(e) => updateField("nearbySalesRange", e.target.value)}
            placeholder="$350k-$425k (similar size)"
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable placeholder:text-neutral-300 ${
              isFieldEmpty("nearbySalesRange")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300"
            }`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.countyPageLink}
          </span>
          <input
            value={fields.countyPageLink}
            onChange={(e) => updateField("countyPageLink", e.target.value)}
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
              isFieldEmpty("countyPageLink")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300"
            }`}
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">
            {FIELD_LABELS.googleDriveLink}
          </span>
          <input
            value={fields.googleDriveLink}
            onChange={(e) => updateField("googleDriveLink", e.target.value)}
            className={`mt-0.5 w-full rounded border px-2 py-1.5 text-sm font-editable ${
              isFieldEmpty("googleDriveLink")
                ? "border-red-300 bg-red-50"
                : "border-neutral-300"
            }`}
          />
        </label>
      </section>

      {/* Photo Uploads */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-medium text-neutral-700">Photos</h3>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Front Photo */}
          <div>
            <span className="text-xs text-neutral-500">Front Photo (5:4)</span>
            <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e, setFrontPhoto)} />
            <div
              onClick={() => frontRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                frontPhoto.preview
                  ? "border-neutral-200"
                  : "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              {frontPhoto.preview ? (
                <img src={frontPhoto.preview} alt="Front" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-400">Click to upload</span>
              )}
            </div>
          </div>

          {/* Satellite Photo */}
          <div>
            <span className="text-xs text-neutral-500">Satellite Photo (5:4)</span>
            <input ref={satRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e, setSatellitePhoto)} />
            <div
              onClick={() => satRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                satellitePhoto.preview
                  ? "border-neutral-200"
                  : "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              {satellitePhoto.preview ? (
                <img src={satellitePhoto.preview} alt="Satellite" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-400">Click to upload</span>
              )}
            </div>
          </div>

          {/* Map Photo */}
          <div>
            <span className="text-xs text-neutral-500">Map Photo (5:4)</span>
            <input ref={mapRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(e, setMapPhoto)} />
            <div
              onClick={() => mapRef.current?.click()}
              className={`mt-1 cursor-pointer rounded-lg border-2 border-dashed aspect-[5/4] flex items-center justify-center overflow-hidden transition-colors ${
                mapPhoto.preview
                  ? "border-neutral-200"
                  : "border-red-300 bg-red-50 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              {mapPhoto.preview ? (
                <img src={mapPhoto.preview} alt="Map" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-neutral-400">Click to upload</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!allRequiredFilled || generating}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-5 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? "Generating..." : "Generate Page"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/marketing-page-creator/create/page.tsx src/app/app/marketing-page-creator/create/client.tsx
git commit -m "Build marketing page create form with lead pre-fill and photo upload"
```

---

### Task 9: Final integration test and version bump

**Files:**
- Modify: `src/components/VersionLabel.tsx`

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Start dev server and test the full flow**

```bash
npm run dev
```

Test:
1. Navigate to `/app/marketing-page-creator` — should show empty table with "+ Create New Page" button
2. Click "+ Create New Page" — should show the form
3. Search for a lead, select it — fields should pre-fill
4. Fill in remaining fields (nearby sales, Google Drive link, photos)
5. Generate button should become enabled when all fields are filled
6. Click Generate — should show loading, then HTML result
7. Copy HTML — should copy to clipboard
8. Click Done — should navigate back to module page
9. History table should show the new entry
10. Click the row — should expand to show HTML
11. Toggle Active/Inactive switch — should toggle

- [ ] **Step 3: Bump version**

In `src/components/VersionLabel.tsx`, change:
```typescript
const CURRENT_VERSION = "1.9.5";
```

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "Bump version to v1.9.5"
git push origin main
```
