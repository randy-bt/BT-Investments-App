# Deals Index + Marketing Page Edit + Archived-Pages Inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public deals index, per-page visibility toggle, edit pencil, and an inline collapsible Archived Pages section under the marketing tab — plus shrink the Indica floating circle back to 56px.

**Architecture:** One additive migration (`show_on_index` on `listing_pages`), two new server actions (visibility toggle + update), one new public route (`/deals-index-active`), one new admin route (`/app/marketing-page-creator/edit/[id]`), and edits to the existing marketing tab to add the toggle column, pencil icon, and collapsible archive section.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4, Supabase, Vitest. Spec at `docs/superpowers/specs/2026-06-10-deals-index-and-marketing-page-edit-design.md`.

---

## File Structure

**Create:**
- `supabase/migrations/057_listing_pages_show_on_index.sql`
- `src/app/deals-index-active/page.tsx` — public deals index server component + inline card grid
- `src/app/app/marketing-page-creator/edit/[id]/page.tsx` — edit page server component

**Modify:**
- `src/actions/listing-pages.ts` — add `setListingPageIndexVisibility` and `updateListingPage` server actions
- `src/app/app/marketing-page-creator/page.tsx` — also fetch archived rows, drop the "Archived Pages" menu card (still keeping the route alive)
- `src/app/app/marketing-page-creator/client.tsx` — add On Index switch column, pencil icon in Actions, collapsible Archived Pages section using `ArchivedPagesTable`
- `src/app/app/marketing-page-creator/archive/archive-table.tsx` — add Seller Name as the first column to match Active Pages; query gains `leads(name)` join
- `src/app/app/marketing-page-creator/archive/page.tsx` — update its select to include `leads(name)` so the standalone route still works after the type change
- `src/app/app/marketing-page-creator/create/client.tsx` — accept optional `existingPage` prop, pre-fill state from it, branch submit to `updateListingPage` in edit mode, render slug read-only with a small note
- `src/lib/types.ts` — add `show_on_index: boolean` to the `ListingPage` type
- `src/components/indica/FloatingIndicaButton.tsx` — shrink button from `h-[70px] w-[70px]` back to `h-14 w-14`; SVG back to `24×24`
- `src/components/VersionLabel.tsx` — bump to v4.22.0

**Tests:**
- `src/__tests__/actions/listing-pages-visibility.test.ts` — `setListingPageIndexVisibility` shape + admin guard (mocked Supabase)
- `src/__tests__/actions/listing-pages-update.test.ts` — `updateListingPage` validates inputs with the existing Zod schema

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/057_listing_pages_show_on_index.sql`

- [ ] **Step 1: Write the SQL**

Create `supabase/migrations/057_listing_pages_show_on_index.sql`:

```sql
-- Per-page visibility toggle for the public deals index at
-- /deals-index-active. Defaults to true so existing rows are immediately
-- shown on the index without manual flipping. The marketing-page-creator
-- table gets a switch to flip it on/off without archiving the page.

ALTER TABLE listing_pages
  ADD COLUMN show_on_index BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX listing_pages_show_on_index_idx
  ON listing_pages(is_active, show_on_index, created_at DESC)
  WHERE is_active = true AND show_on_index = true;
```

- [ ] **Step 2: (HANDLED BY CONTROLLER — DO NOT APPLY)**

Controller applies via Supabase MCP after explicit user confirmation. Skip.

- [ ] **Step 3: Commit**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
git add supabase/migrations/057_listing_pages_show_on_index.sql
git commit -m "Deals index: add show_on_index column to listing_pages"
```

## Context

Work from: `/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments`. The partial index speeds up the deals-index query (which always filters by both `is_active = true` and `show_on_index = true`).

## Report

- Status, commit SHA.

---

## Task 2: Update `ListingPage` TypeScript type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Find the `ListingPage` type definition**

Open `src/lib/types.ts` and locate the `ListingPage` type (search for `interface ListingPage` or `type ListingPage`). Add a new field `show_on_index: boolean` alongside `is_active`.

If the type uses an interface:

```ts
// before:
//   is_active: boolean
// after, immediately after:
   show_on_index: boolean
```

If the type uses an `&` intersection or `pick`/`omit`, just add the field in the right place.

- [ ] **Step 2: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "types\.ts" || echo "no errors in types.ts"
```

Expected: no errors. There may be cascading errors in files that use `ListingPage` without `show_on_index` — those get addressed in their own tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Deals index: add show_on_index to ListingPage type"
```

## Report

- Status, what the surrounding context looked like, commit SHA.

---

## Task 3: Two new server actions — visibility toggle + update

**Files:**
- Modify: `src/actions/listing-pages.ts`
- Create: `src/__tests__/actions/listing-pages-visibility.test.ts`
- Create: `src/__tests__/actions/listing-pages-update.test.ts`

- [ ] **Step 1: Write the visibility-action test**

Create `src/__tests__/actions/listing-pages-visibility.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({ from: mockFrom })),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'u1', role: 'admin' })),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
}))

beforeEach(() => {
  mockEq.mockReset()
  mockUpdate.mockReset()
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
})

describe('setListingPageIndexVisibility', () => {
  it('updates the row with the requested visibility and returns success', async () => {
    const { setListingPageIndexVisibility } = await import('@/actions/listing-pages')
    const result = await setListingPageIndexVisibility('p1', false)

    expect(mockUpdate).toHaveBeenCalledWith({ show_on_index: false })
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
    expect(result).toEqual({ success: true, data: null })
  })

  it('returns the supabase error message on failure', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'boom' } })
    const { setListingPageIndexVisibility } = await import('@/actions/listing-pages')
    const result = await setListingPageIndexVisibility('p1', true)
    expect(result).toEqual({ success: false, error: 'boom' })
  })
})
```

- [ ] **Step 2: Write the update-action test**

Create `src/__tests__/actions/listing-pages-update.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({ from: mockFrom })),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'u1', role: 'admin' })),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockSelect.mockClear()
  mockEq.mockClear()
  mockUpdate.mockClear()
})

describe('updateListingPage', () => {
  it('rejects when inputs fail the Zod schema (no Supabase call)', async () => {
    const { updateListingPage } = await import('@/actions/listing-pages')
    const result = await updateListingPage('p1', {
      address: '',
      // missing required fields — Zod should reject
      inputs: {} as Record<string, unknown>,
    })
    expect(result.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('passes valid inputs through to Supabase and returns the updated row', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'p1', address: 'new addr', inputs: { foo: 'bar' } },
      error: null,
    })

    // Build a valid V2 inputs object that passes the schema.
    const validInputs = {
      address: 'new addr',
      price: '$700,000',
      lotSize: '5,000 sqft',
      zoning: 'RS-1',
      arvRange: '$800K-$850K',
      countyPageLink: 'https://county.example.com/parcel/123',
      googleDriveLink: 'https://drive.google.com/folder/x',
      frontPhotoPath: 'front.jpg',
      satellitePhotoPath: 'sat.jpg',
      cityEyebrow: 'Seattle, WA',
      neighborhood: { mode: 'hidden' as const },
    }

    const { updateListingPage } = await import('@/actions/listing-pages')
    const result = await updateListingPage('p1', {
      address: 'new addr',
      inputs: validInputs,
    })

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npm run test -- listing-pages-visibility listing-pages-update
```

Expected: FAIL — the functions aren't exported yet.

- [ ] **Step 4: Add the two actions to `src/actions/listing-pages.ts`**

Open `src/actions/listing-pages.ts`. Add an import for the Zod schema near the existing imports:

```ts
import { ListingPageV2Inputs } from '@/lib/validations/listing-page-v2'
```

Append these two new exports at the end of the file (after `deleteListingPage`):

```ts

export async function setListingPageIndexVisibility(
  id: string,
  visible: boolean,
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('listing_pages')
      .update({ show_on_index: visible })
      .eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateListingPage(
  id: string,
  input: { address: string; inputs: Record<string, unknown> },
): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const parsed = ListingPageV2Inputs.safeParse(input.inputs)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const path = first?.path.join('.') ?? '(root)'
      return { success: false, error: `Invalid inputs at ${path}: ${first?.message ?? 'unknown'}` }
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .update({
        address: input.address,
        inputs: parsed.data,
        updated_by: user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

If `requireAdmin` isn't already imported in this file, add it to the existing `@/lib/auth` import line alongside `requireAuth`. The `updated_by` column already exists on `listing_pages` per the schema.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test -- listing-pages-visibility listing-pages-update
```

Expected: PASS (4 tests total).

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "listing-pages" || echo "no errors"
```

Expected: no errors in `listing-pages.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/actions/listing-pages.ts src/__tests__/actions/listing-pages-visibility.test.ts src/__tests__/actions/listing-pages-update.test.ts
git commit -m "Deals index: add setListingPageIndexVisibility and updateListingPage actions"
```

## Context

The existing `requireAdmin` helper is already used elsewhere in the codebase (e.g., in lead actions). Both new actions enforce admin role since they modify shared public state.

The `updated_by` column on `listing_pages` was added by an earlier migration; the existing `createListingPage` action sets `created_by` but not `updated_by`. We populate `updated_by` here so the audit trail is correct on edits.

## Report

- Status, test counts, commit SHA.

---

## Task 4: Active Pages table — On Index switch + pencil icon

**Files:**
- Modify: `src/app/app/marketing-page-creator/client.tsx`

- [ ] **Step 1: Add imports for the new action + Link**

Open `src/app/app/marketing-page-creator/client.tsx`. Update the imports block at the top:

```ts
import { useState, useTransition } from "react";
import Link from "next/link";
import { archiveListingPage, deleteListingPage, setListingPageIndexVisibility } from "@/actions/listing-pages";
import type { ActiveListingPageWithLead } from "./page";
import { ArchivedPagesTable } from "./archive/archive-table";
import type { ListingPage } from "@/lib/types";
import { dealUrl } from "@/lib/deal-url";
```

- [ ] **Step 2: Add a `PencilIcon` component next to the other icon components**

Just after the existing `TrashIcon` definition, add:

```tsx
function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-1 9-9-3-3-9 9-1 4z M13 4l3 3" />
    </svg>
  );
}
```

- [ ] **Step 3: Update the `ActivePagesTable` component props to accept archived pages**

Change the component signature so the parent can pass archived rows for the inline collapsible section:

```tsx
export function ActivePagesTable({
  initialPages,
  archivedPages,
}: {
  initialPages: ActiveListingPageWithLead[];
  archivedPages: (ListingPage & { leads: { name: string } | null })[];
}) {
```

- [ ] **Step 4: Wire the On Index toggle handler**

Add a new handler inside the component, alongside `handleArchive`:

```tsx
function handleToggleIndex(id: string, currentVisible: boolean) {
  // Optimistic: flip local state first, revert on error.
  setPages((p) =>
    p.map((x) => (x.id === id ? { ...x, show_on_index: !currentVisible } : x)),
  );
  startTransition(async () => {
    const r = await setListingPageIndexVisibility(id, !currentVisible);
    if (!r.success) {
      // Revert.
      setPages((p) =>
        p.map((x) => (x.id === id ? { ...x, show_on_index: currentVisible } : x)),
      );
    }
  });
}
```

- [ ] **Step 5: Update the grid template + header to include the new "On Index" column between Created and Actions**

Find the existing two `grid grid-cols-[120px_1fr_100px_120px_100px]` instances (one in the header row, one in the body map). Change both to `grid grid-cols-[120px_1fr_100px_120px_80px_120px]` (the new 80px slot is the On Index switch).

In the header row, between the `<span>Created</span>` and `<span className="text-right">Actions</span>` lines, add:

```tsx
<span className="text-center">On Index</span>
```

In the body map, between `<span className="text-xs text-neutral-500">{formatDate(page.created_at)}</span>` and the Actions `<div>`, add a switch:

```tsx
<div className="flex justify-center">
  <button
    type="button"
    onClick={() => handleToggleIndex(page.id, page.show_on_index)}
    disabled={isPending}
    aria-label={page.show_on_index ? "Hide from deals index" : "Show on deals index"}
    title={page.show_on_index ? "Visible on deals index — click to hide" : "Hidden from deals index — click to show"}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
      page.show_on_index ? "bg-[#5c6e2d]" : "bg-neutral-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        page.show_on_index ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
</div>
```

- [ ] **Step 6: Add the pencil icon to the Actions column**

In the Actions `<div>`, between the OpenIcon link and the ArchiveBoxIcon button, add:

```tsx
<Link
  href={`/app/marketing-page-creator/edit/${page.id}`}
  title="Edit"
  aria-label="Edit"
  className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
>
  <PencilIcon />
</Link>
```

- [ ] **Step 7: Add the collapsible Archived Pages section below the active table**

Wrap the existing returned JSX in a fragment and add a `<details>` block underneath. Add this state near the top of the component:

```tsx
const [archivedOpen, setArchivedOpen] = useState(false);
```

Change the final return to wrap both sections:

```tsx
return (
  <>
    <div className="divide-y divide-dashed divide-neutral-200">
      {/* ... existing header + rows ... */}
    </div>

    <details
      open={archivedOpen}
      onToggle={(e) => setArchivedOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-6 rounded border border-dashed border-neutral-200"
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50">
        Archived Pages ({archivedPages.length})
      </summary>
      <div className="border-t border-dashed border-neutral-200">
        <ArchivedPagesTable initialPages={archivedPages} />
      </div>
    </details>
  </>
);
```

The `<details>` element gives us the collapse/expand for free, no JS needed beyond tracking state if we want it.

- [ ] **Step 8: Handle the empty-state branch**

The current code returns an empty-state `<p>No active pages yet</p>` if there are no active pages — but we still want the Archived section to render. Update the empty-state branch to wrap in a fragment with the Archived details below:

```tsx
if (pages.length === 0) {
  return (
    <>
      <p className="text-sm text-neutral-400 py-4">No active pages yet.</p>
      <details
        open={archivedOpen}
        onToggle={(e) => setArchivedOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-2 rounded border border-dashed border-neutral-200"
      >
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50">
          Archived Pages ({archivedPages.length})
        </summary>
        <div className="border-t border-dashed border-neutral-200">
          <ArchivedPagesTable initialPages={archivedPages} />
        </div>
      </details>
    </>
  );
}
```

- [ ] **Step 9: Type-check + lint**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep -E "(marketing-page-creator/client)" || echo "no tsc errors"
npm run lint 2>&1 | grep -E "(marketing-page-creator/client)" || echo "no lint errors"
```

Expected: no errors in `client.tsx`.

- [ ] **Step 10: Commit**

```bash
git add src/app/app/marketing-page-creator/client.tsx
git commit -m "Marketing: On Index switch, pencil icon, inline collapsible archive"
```

## Context

The `<details>` HTML element is the simplest correct way to do collapsibles — no JS required for the collapse behavior. The `archivedOpen` state is only there so we could control it programmatically later (e.g., remember the user's preference). For v1 it's optional polish; the basic `<details>` works without it.

## Report

- Status, tsc + lint, commit SHA.

---

## Task 5: Archive table — Seller Name first column + leads(name) join

**Files:**
- Modify: `src/app/app/marketing-page-creator/archive/archive-table.tsx`
- Modify: `src/app/app/marketing-page-creator/archive/page.tsx`

- [ ] **Step 1: Update the archive table component to accept the joined shape and render Seller Name first**

Open `src/app/app/marketing-page-creator/archive/archive-table.tsx`.

Change the prop type from `ListingPage[]` to a joined shape:

```tsx
import type { ListingPage } from "@/lib/types";

type ArchivedListingPageWithLead = ListingPage & {
  leads: { name: string } | null;
};

export function ArchivedPagesTable({
  initialPages,
}: {
  initialPages: ArchivedListingPageWithLead[];
}) {
```

Update both grid template strings from `grid grid-cols-[1fr_100px_120px_100px]` to `grid grid-cols-[120px_1fr_100px_120px_100px]` (add 120px at the front for Seller Name).

In the header, add a new `<span>Seller Name</span>` as the FIRST `<span>` before `<span>Address</span>`.

In the body map, add `<span className="text-xs text-neutral-600 truncate">{page.leads?.name ?? '—'}</span>` as the FIRST `<span>` in each row, before the Address span.

- [ ] **Step 2: Update the archive/page.tsx server component to also fetch the lead name**

Open `src/app/app/marketing-page-creator/archive/page.tsx`. Find the Supabase query (something like `.from('listing_pages').select('*')`). Change it to `.select('*, leads(name)')`. Cast the data to the new type.

- [ ] **Step 3: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "archive" || echo "no errors"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/marketing-page-creator/archive/archive-table.tsx src/app/app/marketing-page-creator/archive/page.tsx
git commit -m "Marketing: archive table gets Seller Name first column"
```

## Report

- Status, tsc, commit SHA.

---

## Task 6: Marketing page server component — fetch archived rows

**Files:**
- Modify: `src/app/app/marketing-page-creator/page.tsx`

- [ ] **Step 1: Fetch archived rows alongside active**

Open `src/app/app/marketing-page-creator/page.tsx`. In the default-exported function, after the existing active-pages query, add a parallel archived query:

```ts
let archived: (typeof pages)[number][] = [];
try {
  const user = await getAuthUser();
  requireAuth(user);
  const supabase = await createServerClient();
  const { data: aData } = await supabase
    .from("listing_pages")
    .select("*, leads(name)")
    .eq("is_active", false)
    .order("created_at", { ascending: false });
  archived = (aData ?? []) as ActiveListingPageWithLead[];
} catch {
  archived = [];
}
```

(For DRY, you can also combine the two queries by sharing the `supabase`/`user` calls. The simpler diff is to leave them as separate try/catch blocks.)

- [ ] **Step 2: Pass `archivedPages` to the client component**

Change `<ActivePagesTable initialPages={pages} />` to `<ActivePagesTable initialPages={pages} archivedPages={archived} />`.

- [ ] **Step 3: Remove the "Archived Pages" menu card**

Find the `<MenuCard href="/app/marketing-page-creator/archive" ... />` block and delete it. Since archived pages are now inline, the menu card is redundant. The `/archive` route itself stays in place.

This means the `<section className="grid w-full gap-4 sm:grid-cols-2">` becomes a single-card row. Change `sm:grid-cols-2` to `sm:grid-cols-1` for layout cleanliness, or just leave the existing class (an unused grid slot is harmless).

- [ ] **Step 4: Type-check + lint**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "marketing-page-creator/page" || echo "no tsc errors"
npm run lint 2>&1 | grep "marketing-page-creator/page" || echo "no lint errors"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/marketing-page-creator/page.tsx
git commit -m "Marketing: fetch archived rows server-side, drop archive menu card"
```

## Report

- Status, tsc + lint, commit SHA.

---

## Task 7: Parameterize create form for edit mode

**Files:**
- Modify: `src/app/app/marketing-page-creator/create/client.tsx`

This is a 1,400-line file. You'll need to read the relevant sections — form state initialization (near the top) and the submit handler (search for `createListingPage`).

- [ ] **Step 1: Read the file end-to-end before touching it**

Before editing, read the full `src/app/app/marketing-page-creator/create/client.tsx` to understand:
- The form state declarations near the top
- The slug-handling code
- The submit handler that calls `createListingPage`
- Any photo upload state

- [ ] **Step 2: Add an optional `existingPage` prop**

Find the exported component (likely `export function CreateListingPageClient` or similar). Change its props signature to accept an optional `existingPage`:

```tsx
import { createListingPage, updateListingPage } from "@/actions/listing-pages";
import type { ListingPage } from "@/lib/types";

type ExistingPageData = {
  id: string;
  slug: string;
  address: string;
  inputs: Record<string, unknown>;
};

export function CreateListingPageClient({
  existingPage,
}: {
  existingPage?: ExistingPageData;
}) {
```

If the component currently has no props or different props, add `existingPage` alongside whatever exists.

- [ ] **Step 3: Initialize form state from `existingPage.inputs` when present**

For every `useState` that holds a form field (address, price, photos, beds, baths, etc.), change its initial value to fall back from `existingPage?.inputs?.<field>` when present. Example pattern:

```tsx
// before:
const [address, setAddress] = useState("");
// after:
const [address, setAddress] = useState(
  (existingPage?.inputs as { address?: string } | undefined)?.address ?? "",
);
```

Repeat for every form field. If a field has a more complex initial value (e.g., parsed number, boolean), preserve that logic and just substitute the existing value when present.

For photo paths specifically: in edit mode, the form starts with the existing photo paths in state. The upload control should display the existing photo as a preview. If the existing component already handles this via state, you're fine.

- [ ] **Step 4: Branch the submit handler**

Find the submit handler that currently calls `createListingPage(...)`. Wrap the call so it dispatches to either action based on edit mode:

```tsx
const submitResult = existingPage
  ? await updateListingPage(existingPage.id, {
      address: addressValue,
      inputs: composedInputs,
    })
  : await createListingPage({ /* existing args */ });
```

`composedInputs` should be whatever object the create flow builds to pass as `inputs`. The same object is what we send to `updateListingPage`. If the create flow constructs separate fields (price, beds, etc.) and assembles them into `inputs` just before submit, reuse that assembly logic.

If the existing submit handler does `router.push("/app/marketing-page-creator")` on success, leave that — it works for both modes.

- [ ] **Step 5: Render slug as read-only in edit mode**

Find where the slug is displayed in the form (if it's editable, it's probably tied to a state variable). If editable, replace with a read-only display in edit mode:

```tsx
{existingPage ? (
  <div className="text-xs text-neutral-500">
    Slug: <code className="font-mono">{existingPage.slug}</code>
    <span className="ml-2 text-neutral-400">(locked to keep public links stable — to rename, delete and recreate)</span>
  </div>
) : (
  /* existing slug UI, if any */
)}
```

If the existing create flow auto-generates the slug server-side (per `createListingPage`'s `buildSlug` call), there may be no slug input at all — in that case, just add the read-only display in edit mode.

- [ ] **Step 6: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "create/client" || echo "no tsc errors"
```

Expected: no errors. Note: this file is 1400+ lines so subtle type drift is possible. Read carefully.

- [ ] **Step 7: Commit**

```bash
git add src/app/app/marketing-page-creator/create/client.tsx
git commit -m "Marketing: parameterize create form for edit mode"
```

## Context

This is the largest single-file change. Read first, edit minimally. The key insight: the existing form already constructs an `inputs` object before submit — we just dispatch a different action with that same object in edit mode.

## Report

- Status (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT)
- Summary of what you actually changed (which state inits, submit handler shape, slug display)
- tsc result
- Commit SHA
- Any surprises

---

## Task 8: Create the edit page

**Files:**
- Create: `src/app/app/marketing-page-creator/edit/[id]/page.tsx`

- [ ] **Step 1: Write the edit page server component**

Create `src/app/app/marketing-page-creator/edit/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { CreateListingPageClient } from "../../create/client";
import type { ListingPage } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditListingPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getAuthUser();
  requireAuth(user);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("listing_pages")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const page = data as ListingPage;

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center gap-6 w-full max-w-5xl py-10">
        <header className="w-full border-b border-dashed border-neutral-300 pb-4">
          <Link
            href="/app/marketing-page-creator"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Back to Marketing Pages
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Edit Marketing Page
          </h1>
          <p className="text-sm text-neutral-600">
            Updating <code className="font-mono">{page.slug}</code> — changes go live immediately.
          </p>
        </header>

        <CreateListingPageClient
          existingPage={{
            id: page.id,
            slug: page.slug,
            address: page.address,
            inputs: page.inputs as Record<string, unknown>,
          }}
        />
      </div>
    </main>
  );
}
```

If the actual exported name of the create-form component is different (e.g., `CreateForm` or `ListingPageCreator`), use whatever Task 7 confirmed.

- [ ] **Step 2: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "edit/\[id\]/page" || echo "no tsc errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/app/marketing-page-creator/edit/[id]/page.tsx"
git commit -m "Marketing: edit page wires CreateListingPageClient with existing data"
```

## Report

- Status, tsc, commit SHA. Note any difference in the exported component name from Task 7.

---

## Task 9: Public deals index page

**Files:**
- Create: `src/app/deals-index-active/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/deals-index-active/page.tsx`:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PHOTOS_BUCKET = "listing-page-photos";

export const metadata: Metadata = {
  title: "BT Investments — Active Deals",
  description: "Browse current real estate investment opportunities from BT Investments.",
};

type IndexRow = {
  slug: string;
  address: string;
  page_type: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

function pickPhotoPath(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const hero = (inputs as { heroPhotoPath?: string }).heroPhotoPath;
  if (typeof hero === "string" && hero.length > 0) return hero;
  const front = (inputs as { frontPhotoPath?: string }).frontPhotoPath;
  if (typeof front === "string" && front.length > 0) return front;
  return null;
}

function pickPrice(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const price = (inputs as { price?: string }).price;
  return typeof price === "string" && price.length > 0 ? price : null;
}

export default async function DealsIndexActivePage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("listing_pages")
    .select("slug, address, page_type, inputs, created_at")
    .eq("is_active", true)
    .eq("show_on_index", true)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as IndexRow[];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 px-4 py-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          BT Investments — Active Deals
        </h1>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No active deals right now. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
            {rows.map((row) => (
              <DealCard key={row.slug} row={row} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function DealCard({ row }: { row: IndexRow }) {
  const photoPath = pickPhotoPath(row.inputs);
  const price = pickPrice(row.inputs);

  let photoUrl: string | null = null;
  if (photoPath) {
    const admin = createAdminClient();
    photoUrl = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(photoPath).data.publicUrl;
  }

  const href = `/deals/${row.slug}`;

  return (
    <li className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="block">
        <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={row.address}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              No photo
            </div>
          )}
        </div>
        <div className="px-4 py-3">
          {price && (
            <p className="text-base font-semibold text-neutral-900 sm:text-lg">{price}</p>
          )}
          <p className="mt-1 text-xs text-neutral-600 sm:text-sm">{row.address}</p>
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "deals-index-active" || echo "no tsc errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/deals-index-active/page.tsx
git commit -m "Deals index: public /deals-index-active card grid page"
```

## Context

The route is public (no auth) because the marketing pages it links to are also public. Using `createAdminClient` bypasses RLS so the SELECT works for unauthenticated visitors. The query filters strictly on `is_active = true AND show_on_index = true`.

`getPublicUrl` is sync and just builds a URL; no network call. The photos are in a public-readable bucket already (per existing marketing-page behavior).

## Report

- Status, tsc, commit SHA.

---

## Task 10: Shrink Indica circle back to 56px

**Files:**
- Modify: `src/components/indica/FloatingIndicaButton.tsx`

- [ ] **Step 1: Revert the button + icon size to pre-25%-bump values**

Open `src/components/indica/FloatingIndicaButton.tsx`. Find these two changes from the previous bundle:

- `h-[70px] w-[70px]` → change back to `h-14 w-14`
- The SVG `width="28" height="28"` → change back to `width="24" height="24"`

Leave the z-index at `z-[60]` (the navbar fix still applies). Leave the "Ask Indica" hover label as-is.

- [ ] **Step 2: Type-check + lint**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "FloatingIndicaButton" || echo "no tsc errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/indica/FloatingIndicaButton.tsx
git commit -m "Indica: shrink floating circle back to 56px"
```

## Report

- Status, commit SHA.

---

## Task 11: Bump version + push + manual verification

**Files:**
- Modify: `src/components/VersionLabel.tsx`

- [ ] **Step 1: Bump version**

Open `src/components/VersionLabel.tsx`. Change `CURRENT_VERSION` from `"4.21.3"` to `"4.22.0"`.

- [ ] **Step 2: Run full test suite**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npm run test 2>&1 | tail -5
```

Expected: all tests pass except the pre-existing `investors.test.ts` failure.

- [ ] **Step 3: Commit + push**

```bash
git add src/components/VersionLabel.tsx
git commit -m "Bump version to v4.22.0 (deals index + marketing edit + inline archive)"
git push origin main
```

- [ ] **Step 4: Manual verification post-deploy** (Randy does this)

After Vercel finishes building:

1. **Deals index public page** — visit `btinvestments.co/deals-index-active` while logged out. See the grid of currently-active pages (2 cols mobile, 3 cols tablet+). Click any card → land on `/deals/<slug>`. Photos load.

2. **Visibility toggle** — from `/app/marketing-page-creator`, find a page, click the On Index switch off. Refresh `/deals-index-active` in another tab → that card is gone. Toggle back on → it returns.

3. **Edit pencil** — click the pencil on a page → edit form opens with all fields pre-filled. Change the price → save. Visit the public `/deals/<slug>` → new price renders.

4. **Slug locked** — in the edit form, confirm the slug is read-only with the explanation text.

5. **Archived inline** — on `/app/marketing-page-creator`, click "Archived Pages (N)" strip → archive table expands inline. First column is Seller Name. Collapse again.

6. **Indica circle shrink** — open any lead record. Plum circle is back to 56px. Still sits above the navbar gradient. Still shows the "Ask Indica" pill on hover.

---

## Self-Review

**Spec coverage:**
- show_on_index column → Task 1
- ListingPage type updated → Task 2
- setListingPageIndexVisibility + updateListingPage actions → Task 3
- On Index switch column → Task 4
- Pencil icon in Actions → Task 4
- Archive table reordered → Task 5
- Archived pages inline collapsible → Tasks 4 + 6
- Edit form (parameterized create) → Task 7
- Edit page server component → Task 8
- Public deals index → Task 9
- Indica circle shrink → Task 10
- Version bump + push + manual verify → Task 11

**Placeholder scan:** No "TBD"/"implement later" — every step has the actual code or a precise command.

**Type consistency:**
- `existingPage: ExistingPageData` shape declared in Task 7, consumed identically in Task 8. ✓
- `setListingPageIndexVisibility(id: string, visible: boolean)` and `updateListingPage(id, input)` — same signatures across Tasks 3 (define), 4 (visibility use), 7 (update use). ✓
- `ActiveListingPageWithLead` reused across page.tsx and client.tsx; archive gets its own equivalent with the same shape. ✓
- The `show_on_index` field is added to `ListingPage` in Task 2 and referenced in Tasks 4, 9 — consistent. ✓
- Indica button size revert in Task 10 references the original values verbatim. ✓

Plan is internally consistent.
