# Deals Index + Marketing Page Edit + Archived-Pages Inline — Design

**Status:** Approved, proceed to implementation plan
**Date:** 2026-06-10

## Goal

Bundle four related changes to the marketing-page management surface:

1. **Public deals index** at `btinvestments.co/deals-index-active` — a card grid of every active marketing page, click-through to the existing per-deal marketing page.
2. **Per-page visibility toggle** — admin can hide a specific page from the deals index without archiving it.
3. **Edit existing marketing pages** — pencil icon in the Active Pages table opens an edit form that updates the live page.
4. **Archived pages inline** — collapsible section below the Active Pages table that shows the same data the standalone `/archive` route shows today.

Plus one side-fix: shrink the Indica floating circle from 70px back to 56px.

Internally we'll refer to the new public page as **"the deals index."**

## Out of scope

- Cross-deal aggregation or analytics (e.g. "deals by city").
- Photo cleanup for orphaned blobs in Supabase Storage when a page is edited.
- Public deals-index filtering or search (just a chronological grid in v1).
- Editing the slug — intentionally locked to keep public URLs stable.
- Removing the standalone `/app/marketing-page-creator/archive` route (kept for bookmark compatibility).

## Data model

### New column on `listing_pages`

```sql
ALTER TABLE listing_pages
  ADD COLUMN show_on_index BOOLEAN NOT NULL DEFAULT true;
```

All existing rows backfill to `true` via the `DEFAULT`. New pages default to visible. Migration is additive and reversible.

The existing `/deals/<slug>` route ignores `show_on_index` — it serves any active page, deals-index visibility is a separate concern.

## Public deals index

**URL:** `/deals-index-active` (top-level public route).

**Route file:** `src/app/deals-index-active/page.tsx` (server component).

**Data:** `SELECT slug, address, style_id, inputs, created_at FROM listing_pages WHERE is_active = true AND show_on_index = true ORDER BY created_at DESC`. Service role read (the route is public, no auth context).

**Layout:**
- Slim brand bar header centered with "BT Investments — Active Deals".
- Grid of cards:
  - **2 columns on mobile**, **3 columns on tablet+** (matches Randy's preference: 2/3/3 instead of 1/2/3).
  - Generous whitespace between cards.
  - Cards have rounded corners, subtle shadow, hover lift (scale + stronger shadow).
- Empty state: centered text *"No active deals right now. Check back soon."*

**Each card:**
- Hero photo at top, fixed 16:9 aspect ratio, object-cover so odd-shaped uploads don't distort the layout.
- Below photo: **price** large/bold, **address** smaller in secondary color.
- Photo source: `inputs.heroPhotoPath`, fallback `inputs.frontPhotoPath`, fallback neutral placeholder div if neither.
- Card is one big clickable link → `/deals/<slug>` in the **same tab** (back-button returns to the index).

## Per-page visibility toggle

**On Active Pages table** (`src/app/app/marketing-page-creator/client.tsx`):

- New column **"On Index"** between Created and Actions.
- Body: a small switch component. Sage-green when on, gray when off. Click → optimistic UI flip → server action persists.
- Default state on a brand-new page is ON (database default).

**Server action:** `setListingPageIndexVisibility(pageId: string, visible: boolean): Promise<ActionResult<null>>` in `src/actions/listing-pages.ts` (or extend the existing actions file if one exists). Admin-only via `requireAdmin`.

## Edit existing marketing pages

**Pencil icon:** added to the **Actions** column of the Active Pages table next to whatever's there now. Routes to `/app/marketing-page-creator/edit/[id]`.

**Edit page:** `src/app/app/marketing-page-creator/edit/[id]/page.tsx` (server component that fetches the existing `listing_pages` row) + reuses the existing create form component, parameterized.

**Form parameterization:**
- The existing form component at `src/app/app/marketing-page-creator/create/client.tsx` is refactored to accept an optional `existingPage` prop containing `{ id, slug, address, inputs }`.
- If `existingPage` is absent → render with empty defaults, submit creates a new row (existing behavior).
- If `existingPage` is present → pre-fill every input from the existing row, submit updates the row in place.

**What's editable:** all content fields (price, address, descriptions, photos, anything else in the V2 inputs schema).

**Photo handling on edit:** the upload control behaves the same as in create. Uploading replaces the path on the row. The old blob in Supabase Storage is left in place (orphaned but harmless — cleanup is a separate future job).

**What's locked:**
- **Slug.** Shown as read-only text with a small caption: *"Slug is locked to keep links stable. To rename, delete and recreate."*

**Save behavior:** instant publish. Submit → row updated in DB → live `/deals/<slug>` reflects on the next visit (it already reads from DB on every request, no caching layer in the way).

**Cancel:** back-link to the marketing tab. No draft state, no unsaved-changes warning for v1.

**Server action:** `updateListingPage(id: string, input: { address, inputs }): Promise<ActionResult<ListingPage>>` in `src/actions/listing-pages.ts`. Validates with the existing `ListingPageV2Inputs` Zod schema. Admin-only.

## Archived pages inline

**On the marketing tab** (`src/app/app/marketing-page-creator/client.tsx`):

Below the Active Pages table, add a collapsible accordion section:

- **Header strip:** small clickable bar labeled `Archived Pages (N)` with a chevron icon (right when collapsed, down when expanded). Click anywhere on the strip toggles.
- **Default state:** collapsed.
- **Body when expanded:** renders the existing archive table component from `src/app/app/marketing-page-creator/archive/archive-table.tsx`, with archived rows fetched at server-component level alongside the active rows.

**Column shape:** archive table gets the same column order as the active table — **Seller Name | Address | Type | Created | Actions**. This makes the two tables visually consistent when both are expanded.

**Standalone `/archive` route:** kept in place. Both surfaces render the same component, just mounted differently.

## Indica circle side-fix

Shrink the floating circle from `h-[70px] w-[70px]` back to `h-14 w-14` (56px — the original size before the 25% bump). Icon back to `width="24" height="24"`. Z-index stays at `z-[60]` so the navbar gradient still doesn't cover it.

## Files to create / modify

**Create:**
- `supabase/migrations/057_listing_pages_show_on_index.sql`
- `src/app/deals-index-active/page.tsx` — public deals index page
- `src/app/deals-index-active/DealsIndexGrid.tsx` — client/presentational grid (or keep as server component if no interactivity needed)
- `src/app/app/marketing-page-creator/edit/[id]/page.tsx` — server component fetching the existing row
- `src/actions/listing-pages.ts` (or add to existing file) — `setListingPageIndexVisibility` + `updateListingPage` actions

**Modify:**
- `src/app/app/marketing-page-creator/page.tsx` — fetch archived rows alongside active, pass both to client
- `src/app/app/marketing-page-creator/client.tsx` — add On Index column + switch + pencil icon + collapsible Archived Pages section
- `src/app/app/marketing-page-creator/create/client.tsx` — parameterize for edit mode (accept optional `existingPage` prop, conditional submit)
- `src/app/app/marketing-page-creator/archive/archive-table.tsx` — reorder columns so Seller Name is first (match Active Pages table)
- `src/lib/validations/listing-page-v2.ts` (if needed) — keep schema unchanged; edit reuses it
- `src/components/indica/FloatingIndicaButton.tsx` — shrink button back to 56px
- `src/components/VersionLabel.tsx` — bump to v4.22.0 (minor: meaningful new public page + edit feature)

## Testing

**Unit (Vitest):**
- `src/__tests__/lib/listing-pages/visibility-action.test.ts` — `setListingPageIndexVisibility` flips the column; rejects non-admin (mocked).
- `src/__tests__/lib/listing-pages/update-action.test.ts` — `updateListingPage` validates inputs with the existing Zod schema; reflects updates in the returned row.

**Manual verification (post-deploy):**
1. Open `/deals-index-active` while logged out — see the grid of currently-active pages with photo + price + address. Click any card → land on `/deals/<slug>`.
2. From `/app/marketing-page-creator`, toggle "On Index" off on a page → refresh `/deals-index-active` → that card is gone. Toggle back on → it returns.
3. Click the pencil on a page → edit page opens with all fields pre-filled. Change the price → save → visit the public `/deals/<slug>` → new price renders.
4. Confirm the slug field is read-only in edit mode and the public URL doesn't change.
5. Click the "Archived Pages (N)" strip → archive table expands inline with Seller Name as the first column. Collapse again.
6. Confirm Indica's floating circle is back to 56px and still sits above the navbar gradient.

## Rollout

Single deploy:
1. Apply migration `057` to production Supabase.
2. Ship code; Vercel deploys.
3. Bump to v4.22.0.

No feature flag. The deals index is immediately public.

## Future (not in this spec)

- Public deals-index filtering by city / price range.
- Photo cleanup job for orphaned blobs in Supabase Storage.
- Editable slug with redirect support (if it ever becomes a real need).
- Public-side analytics on which cards get clicked.
