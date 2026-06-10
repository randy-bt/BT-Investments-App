# PSA Blank-Field Safeguards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent another signed PSA from going out with silent blank required fields, the way the Xiaoxi Bai PSA did with `closing_date` and `emd_date` blank in §4/§7/§10.

**Architecture:** Three independent layers of defense:
1. Fix the `getLeadAutofillValues` action so it returns `undefined` for null lead fields instead of `""` — stops the form from wiping manually-typed values when picking a lead.
2. Add an orphan-placeholder scan inside `generateAgreementPdf` — after Google Docs substitutes placeholders, fetch the doc text and refuse to export if any `{{...}}` patterns survived.
3. Add an inline yellow warning + click-through confirm flow in the create form, so generating with blank required fields requires deliberate confirmation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, server actions, Vitest. Spec lives in the conversation (no separate spec doc — design was approved iteratively).

---

## File Structure

**Modify:**
- `src/actions/agreements.ts` — null-safe autofill in `getLeadAutofillValues`
- `src/lib/google-docs.ts` — orphan-placeholder scan in `generateAgreementPdf`
- `src/app/app/agreements/create/create-form.tsx` — inline yellow warning + confirm-to-proceed + post-gen summary

**Create:**
- `src/__tests__/lib/google-docs-orphan-scan.test.ts` — unit test for the orphan-scan helper (extracted as a pure function)

---

## Task 1: Null-safe `getLeadAutofillValues`

**Files:**
- Modify: `src/actions/agreements.ts` (lines 183-209)

- [ ] **Step 1: Open the file and rewrite the values map**

Open `src/actions/agreements.ts`. The current `getLeadAutofillValues` builds its return map with `?? ''` defaults, like:

```ts
const values: Record<string, string> = {
  lead_name: lead.name ?? '',
  lead_mailing_address: lead.mailing_address ?? '',
  // ... etc
  lead_emd_date: lead.emd_date ?? '',
  lead_closing_date: lead.closing_date ?? '',
  // ... etc
}
return { success: true, data: values }
```

Change it to build a `Record<string, string | undefined>` where null lead fields stay `undefined`. The form-side `applyAutofill` already checks `autofill[v.autofillFrom] !== undefined`, so undefined values will be skipped instead of overwriting manual entries.

Replace the entire `values` block (lines 183-209) with this version that omits null fields:

```ts
const raw: Record<string, string | null | undefined> = {
  lead_name: lead.name,
  lead_mailing_address: lead.mailing_address,
  lead_occupancy_status: lead.occupancy_status,
  lead_asking_price: lead.asking_price,
  lead_our_current_offer: lead.our_current_offer != null ? String(lead.our_current_offer) : null,
  lead_range: lead.range,
  lead_selling_timeline: lead.selling_timeline,
  lead_condition: lead.condition,
  lead_emd_date: lead.emd_date,
  lead_closing_date: lead.closing_date,
  lead_primary_phone: primaryPhone?.phone_number,
  lead_primary_email: primaryEmail?.email,
  property_address: property?.address,
  property_apn: property?.apn,
  property_county: property?.county,
  property_zoning: property?.zoning,
  property_legal_description: property?.legal_description,
  property_year_built: property?.year_built != null ? String(property.year_built) : null,
  property_bedrooms: property?.bedrooms != null ? String(property.bedrooms) : null,
  property_bathrooms: property?.bathrooms != null ? String(property.bathrooms) : null,
  property_sqft: property?.sqft != null ? String(property.sqft) : null,
  property_lot_size: property?.lot_size,
  property_property_type: property?.property_type,
  property_owner_name: property?.owner_name,
  property_owner_mailing_address: property?.owner_mailing_address,
}

// Drop keys whose value is null/undefined/empty so the form-side autofill
// loop skips them (it checks `!== undefined`) and doesn't wipe manually-
// typed values when picking a lead with sparse data.
const values: Record<string, string> = {}
for (const [k, v] of Object.entries(raw)) {
  if (v != null && v !== '') values[k] = v
}
return { success: true, data: values }
```

Also update the return type annotation on the function: change

```ts
): Promise<ActionResult<Record<string, string>>> {
```

to keep `Record<string, string>` — that's still accurate after the filter; the values map only contains real string values.

- [ ] **Step 2: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "agreements\.ts" || echo "no errors in agreements.ts"
```

Expected: no errors.

- [ ] **Step 3: Run full test suite to catch regressions**

```bash
npm run test
```

Expected: no NEW failures. Pre-existing `investors.test.ts` failure is unrelated — leave it.

- [ ] **Step 4: Commit**

```bash
git add src/actions/agreements.ts
git commit -m "Agreements: skip null lead fields in autofill so manual values stick"
```

---

## Task 2: Orphan-placeholder scan in `generateAgreementPdf`

**Files:**
- Modify: `src/lib/google-docs.ts`
- Create: `src/__tests__/lib/google-docs-orphan-scan.test.ts`

- [ ] **Step 1: Write the failing test for the orphan-scan helper**

Create `src/__tests__/lib/google-docs-orphan-scan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findOrphanPlaceholders } from '@/lib/google-docs'

describe('findOrphanPlaceholders', () => {
  it('returns empty array when no placeholders remain', () => {
    expect(findOrphanPlaceholders('clean text')).toEqual([])
    expect(findOrphanPlaceholders('')).toEqual([])
  })

  it('finds a single orphan placeholder', () => {
    expect(findOrphanPlaceholders('hello {{name}} world')).toEqual(['{{name}}'])
  })

  it('finds multiple orphan placeholders, deduped and sorted', () => {
    const text = '{{closing_date}} foo {{emd_date}} bar {{closing_date}} baz {{inspection_date}}'
    expect(findOrphanPlaceholders(text)).toEqual([
      '{{closing_date}}',
      '{{emd_date}}',
      '{{inspection_date}}',
    ])
  })

  it('ignores placeholder-like strings that do not match the {{...}} shape', () => {
    expect(findOrphanPlaceholders('{ not_a_placeholder }')).toEqual([])
    expect(findOrphanPlaceholders('{{}}')).toEqual([])
    expect(findOrphanPlaceholders('{{ has spaces }}')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- google-docs-orphan-scan.test.ts
```

Expected: FAIL — `findOrphanPlaceholders` is not exported yet.

- [ ] **Step 3: Add the helper + wire it into `generateAgreementPdf`**

Open `src/lib/google-docs.ts`. At the end of the file (after the existing `generateAgreementPdf` function), add this exported helper:

```ts

/**
 * Find `{{key}}`-shaped placeholders that survived template substitution.
 * Returns deduped sorted array. Only matches strict {{key}} format
 * (alphanumeric / underscore inside, no spaces, non-empty).
 */
export function findOrphanPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{[A-Za-z0-9_]+\}\}/g) ?? []
  return Array.from(new Set(matches)).sort()
}
```

Then add a helper to extract plain text from a Google Doc body. Place it above `generateAgreementPdf`:

```ts

// Walk a Google Doc body's structuralElements and concatenate every
// text-run's content. Sufficient for detecting leftover {{placeholders}};
// not intended as a faithful Doc renderer.
function extractDocText(doc: docs_v1.Schema$Document): string {
  const parts: string[] = []
  const elements = doc.body?.content ?? []
  for (const el of elements) {
    const paraElements = el.paragraph?.elements ?? []
    for (const pe of paraElements) {
      const content = pe.textRun?.content
      if (content) parts.push(content)
    }
    // Tables can contain placeholders too — walk their cells.
    for (const row of el.table?.tableRows ?? []) {
      for (const cell of row.tableCells ?? []) {
        for (const cellEl of cell.content ?? []) {
          for (const pe of cellEl.paragraph?.elements ?? []) {
            const content = pe.textRun?.content
            if (content) parts.push(content)
          }
        }
      }
    }
  }
  return parts.join('')
}
```

Now modify `generateAgreementPdf` to fetch the doc text after `batchUpdate` and refuse to export if orphans are found. Find the existing block (around lines 88-100):

```ts
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      })
    }

    // 3. Export as PDF
    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(pdfRes.data as ArrayBuffer)
```

Replace it with this version that scans for orphans before export:

```ts
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      })
    }

    // 3. Fetch the post-substitution doc and refuse to export if any
    // {{placeholder}} patterns survived — that means either the values
    // map was missing a key, or the Google Doc has a placeholder no
    // template variable defines.
    const filledDoc = await docs.documents.get({ documentId: tempDocId })
    const orphans = findOrphanPlaceholders(extractDocText(filledDoc.data))
    if (orphans.length > 0) {
      throw new Error(
        `Template has unfilled placeholders after substitution: ${orphans.join(', ')}. ` +
        `Either the template-variable list is missing these keys, or the Google Doc has placeholders that no variable defines.`,
      )
    }

    // 4. Export as PDF
    const pdfRes = await drive.files.export(
      { fileId: tempDocId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(pdfRes.data as ArrayBuffer)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- google-docs-orphan-scan.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "google-docs\.ts" || echo "no errors in google-docs.ts"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/google-docs.ts src/__tests__/lib/google-docs-orphan-scan.test.ts
git commit -m "Agreements: refuse PDF export if orphan {{placeholders}} remain"
```

---

## Task 3: Inline yellow warning + click-through + post-gen summary in create form

**Files:**
- Modify: `src/app/app/agreements/create/create-form.tsx`

- [ ] **Step 1: Update the form state and onGenerate handler**

Open `src/app/app/agreements/create/create-form.tsx`.

Find the existing state declarations near the top (around lines 24-28):

```ts
const [templateId, setTemplateId] = useState<string>("");
const [leadId, setLeadId] = useState<string>("");
const [values, setValues] = useState<FormState>({});
const [isPending, startTransition] = useTransition();
const [error, setError] = useState<string | null>(null);
```

Add two new state items right below them:

```ts
const [missingRequired, setMissingRequired] = useState<string[]>([]);
const [postGenBlanks, setPostGenBlanks] = useState<string[]>([]);
```

Find the existing `onGenerate` function (around lines 151-181). Replace it entirely with the click-through version:

```ts
async function onGenerate() {
  if (!template) return;
  setError(null);

  // Collect the required fields that are blank.
  const missing: string[] = [];
  for (const v of template.variables) {
    if (v.required && v.type !== "checkbox") {
      const val = values[v.key];
      if (!val || (typeof val === "string" && !val.trim())) {
        missing.push(v.label);
      }
    }
  }

  // First click with blanks: show the inline yellow warning. Second click
  // with the same set of blanks: proceed with generation.
  if (missing.length > 0) {
    const sameAsLastWarning =
      missing.length === missingRequired.length &&
      missing.every((m, i) => m === missingRequired[i]);
    if (!sameAsLastWarning) {
      setMissingRequired(missing);
      return;
    }
    // sameAsLastWarning === true → user has acknowledged; fall through.
  } else {
    // No blanks → clear any stale warning.
    setMissingRequired([]);
  }

  const blanksAtSubmit = [...missing];
  const resolved = resolveForSubmit(template, values);
  startTransition(async () => {
    const res = await generateAgreement({
      template_id: template.id,
      lead_id: leadId || null,
      values: resolved,
    });
    if (!res.success) {
      setError(res.error);
      return;
    }
    // Surface a post-gen summary if any required fields were blank
    // when this was generated (the user clicked through the warning).
    if (blanksAtSubmit.length > 0) {
      setPostGenBlanks(blanksAtSubmit);
    }
    const urlRes = await getAgreementDownloadUrl(res.data.id);
    if (urlRes.success) window.open(urlRes.data, "_blank");
    if (blanksAtSubmit.length === 0) {
      router.push("/app/agreements");
    }
    // If there were blanks, stay on the form and show the summary banner.
    // The user clicks "Continue to Agreements" to leave.
  });
}
```

- [ ] **Step 2: Reset the warning whenever the form state changes**

Find the existing `setValue` function (around lines 105-110):

```ts
function setValue(key: string, value: string | boolean) {
  if (!template) return;
  setValues((prev) =>
    recomputeComputeds({ ...prev, [key]: value }, template)
  );
}
```

Replace it with this version that clears the warning on any edit:

```ts
function setValue(key: string, value: string | boolean) {
  if (!template) return;
  // Any form edit resets the click-through warning — user has to confirm
  // again if they still have blanks after the change.
  if (missingRequired.length > 0) setMissingRequired([]);
  setValues((prev) =>
    recomputeComputeds({ ...prev, [key]: value }, template)
  );
}
```

- [ ] **Step 3: Add the inline yellow banner + the post-gen summary banner to the JSX**

Find where the existing error message is rendered. Look for something like:

```tsx
{error && (
  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
    {error}
  </div>
)}
```

If you don't find that exact block, look for the Generate button (it'll have label "Generate" or be a `<button>` with `onClick={onGenerate}`). The banners go ABOVE the Generate button.

Add these two banners adjacent to the existing error display (above the Generate button):

```tsx
{postGenBlanks.length > 0 && (
  <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2">
    <p className="font-medium">
      This PDF was generated with blank lines for: {postGenBlanks.join(", ")}.
    </p>
    <p className="text-xs">
      Fill them in by hand before sending, or close this and edit the lead record, then re-generate.
    </p>
    <button
      type="button"
      onClick={() => router.push("/app/agreements")}
      className="rounded border border-amber-400 bg-white px-3 py-1 text-xs hover:bg-amber-100"
    >
      Continue to Agreements
    </button>
  </div>
)}

{missingRequired.length > 0 && (
  <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
    <p className="font-medium">
      The following required fields are blank: {missingRequired.join(", ")}.
    </p>
    <p className="mt-1 text-xs">
      The PDF will render those as blank lines you can fill in by hand. Click <strong>Generate</strong> again to confirm and proceed.
    </p>
  </div>
)}
```

The `postGenBlanks` banner is shown only after a successful generation that had blanks. The `missingRequired` banner is shown when the user clicked Generate but has blank required fields and hasn't confirmed yet.

- [ ] **Step 4: Type-check**

```bash
cd "/Users/groovehouseent/Developer/Bt Investments App Development/bt-investments"
npx tsc --noEmit 2>&1 | grep "create-form" || echo "no errors in create-form"
```

Expected: no errors.

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | grep "create-form" || echo "no lint errors"
```

Expected: no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/agreements/create/create-form.tsx
git commit -m "Agreements: inline yellow warning + click-through for blank required fields"
```

---

## Task 4: Bump version + manual verification

**Files:**
- Modify: `src/components/VersionLabel.tsx`

- [ ] **Step 1: Bump the version**

Open `src/components/VersionLabel.tsx` and bump the CURRENT_VERSION constant from `4.18.0` to `4.19.0`.

- [ ] **Step 2: Commit + push**

```bash
git add src/components/VersionLabel.tsx
git commit -m "Bump version to v4.19.0 (PSA blank-field safeguards)"
git push origin main
```

- [ ] **Step 3: Manual verification post-deploy** (Randy does this)

After Vercel finishes building:

1. **Happy path** — open `/app/agreements/create`, pick PSA template + a lead that DOES have `emd_date` and `closing_date` filled. Confirm the dates autofill. Click Generate. Confirm PDF generates cleanly with no banners.

2. **Click-through with blanks** — pick a lead that has NO `emd_date` or `closing_date` (most leads). Don't manually fill those fields in the form. Click Generate. Confirm a yellow banner appears listing "Closing Date, EMD / Inspection Date" — and the form does NOT submit. Click Generate again. Confirm the PDF generates, opens in a new tab with blank lines in §4/§7/§10, and a post-gen yellow banner appears listing those fields.

3. **Manual override** — pick a lead with no dates set. Manually type a date into "Closing Date" in the form. Click Generate. Confirm only "EMD / Inspection Date" shows in the warning (closing date no longer flagged). Click again. PDF generates with closing date filled and EMD blank.

4. **Autofill-overwrite regression** — type a closing date into the form. THEN pick a different lead from the dropdown (one with NO closing date set). Confirm your typed closing date is NOT wiped out (the bug fix from Task 1).

5. **Orphan-placeholder safety net** — (this one is harder to test without messing with the Google Doc, so skip unless someone edits the template). If you ever add a `{{some_new_var}}` to the Google Doc but forget to add `some_new_var` as a template variable in the JSON, the Generate action will fail with a clear error naming the orphan.

---

## Self-Review

**Spec coverage:**
- Inline yellow warning when required fields are blank → Task 3
- Click-through (Generate again) to proceed → Task 3
- Blank lines in PDF (not "[MISSING: ...]") → Task 3 (`resolveForSubmit` already passes through `""` which Docs renders as nothing — no change needed)
- Post-gen summary banner naming the blanks → Task 3
- Autofill-overwrite bug fix → Task 1
- Orphan-placeholder scan post-render → Task 2
- Version bump + manual verification → Task 4

**Placeholder scan:** No TBD, every step has complete code and exact commands. ✓

**Type consistency:**
- `missingRequired: string[]` and `postGenBlanks: string[]` — both defined in Task 3 Step 1 and used in Step 3 banner JSX. ✓
- `findOrphanPlaceholders(text: string): string[]` — same signature in Task 2 test and implementation. ✓
- `extractDocText(doc): string` — internal helper, only consumed inside `generateAgreementPdf`. ✓
- `getLeadAutofillValues` return type unchanged at `ActionResult<Record<string, string>>` — the filtered map still matches. ✓

Plan is consistent and ready to execute.
