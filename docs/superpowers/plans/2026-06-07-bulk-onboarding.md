# Bulk Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Randy drop multiple properly-named audio files at once and onboard each as its own lead record, with a preview-then-create flow.

**Architecture:** Sibling `+ Bulk Onboard` button next to the existing `+ Onboarding` button → new page at `/app/acquisitions/bulk-onboard`. The page parses each filename client-side, checks for duplicate phones via a new server action, shows a preview table with ✅/⚠️/❌ states, and sequentially calls the existing `createLead` server action + the existing 3-step attachment upload pattern for each selected row.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind 4, existing Supabase server actions (`createLead`, `createUpdate`, `getUploadUrl`, `createAttachmentRecord`). Spec: `docs/superpowers/specs/2026-06-07-bulk-onboarding-design.md`.

---

## File Structure

**Create:**
- `src/lib/onboarding/parse-filename.ts` — moved from `LeadForm.tsx`, exports `parseOnboardingFilename` + `ParsedLead` type
- `src/lib/onboarding/normalize-phone.ts` — pure phone normalization helper
- `src/actions/lead-lookup.ts` — `getLeadIdsByPhones` server action
- `src/app/app/acquisitions/bulk-onboard/page.tsx` — server-component shell
- `src/app/app/acquisitions/bulk-onboard/client.tsx` — dropzone + preview + create loop
- `src/__tests__/lib/onboarding/parse-filename.test.ts`
- `src/__tests__/lib/onboarding/normalize-phone.test.ts`

**Modify:**
- `src/components/LeadForm.tsx` — import `parseOnboardingFilename` from new location, drop the local copy
- `src/app/app/acquisitions/page.tsx` — add `+ Bulk Onboard` button to header
- `src/app/app/acquisitions/all-leads/page.tsx` — add `+ Bulk Onboard` button to header

---

## Task 1: Extract `parseOnboardingFilename` into its own file

**Files:**
- Create: `src/lib/onboarding/parse-filename.ts`
- Modify: `src/components/LeadForm.tsx`
- Test: `src/__tests__/lib/onboarding/parse-filename.test.ts`

- [ ] **Step 1: Write failing tests for the parser**

Create `src/__tests__/lib/onboarding/parse-filename.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseOnboardingFilename } from '@/lib/onboarding/parse-filename'

describe('parseOnboardingFilename', () => {
  it('parses a valid filename', () => {
    const result = parseOnboardingFilename('6.7 John Doe 45 - 123 Main St Seattle WA - 555-1234 - Direct Mail.mp3')
    const year = new Date().getFullYear()
    expect(result).toEqual({
      date: `${year}-06-07`,
      name: 'John Doe',
      address: '123 Main St Seattle WA',
      phone: '555-1234',
      campaign: 'Direct Mail',
    })
  })

  it('pads single-digit month/day with zero', () => {
    const result = parseOnboardingFilename('1.5 Jane Smith 32 - 1 A St - 555-0000 - Email.m4a')
    expect(result?.date).toMatch(/^\d{4}-01-05$/)
  })

  it('handles multi-word names', () => {
    const result = parseOnboardingFilename('6.7 Maria Jose Vargas Lopez 55 - 1 A St - 555-0000 - Direct Mail.mp3')
    expect(result?.name).toBe('Maria Jose Vargas Lopez')
  })

  it('returns null when filename has wrong number of dash-separated parts', () => {
    expect(parseOnboardingFilename('not a valid filename.mp3')).toBeNull()
    expect(parseOnboardingFilename('6.7 Name 45 - addr - phone.mp3')).toBeNull()
  })

  it('returns null when the date token is not M.D', () => {
    expect(parseOnboardingFilename('foo Name 45 - addr - phone - campaign.mp3')).toBeNull()
  })

  it('returns null when the last token of leadInfo is not numeric (missing age)', () => {
    expect(parseOnboardingFilename('6.7 John Doe - addr - phone - campaign.mp3')).toBeNull()
  })

  it('returns null when there are no name tokens between date and age', () => {
    expect(parseOnboardingFilename('6.7 45 - addr - phone - campaign.mp3')).toBeNull()
  })

  it('strips multiple extensions (only the last one)', () => {
    const result = parseOnboardingFilename('6.7 John Doe 45 - addr - 555-0000 - Mail.tar.gz')
    expect(result?.name).toBe('John Doe')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/groovehouseent/Desktop/Bt Investments App Development/bt-investments"
npm run test -- parse-filename.test.ts
```

Expected: FAIL — `Cannot find package '@/lib/onboarding/parse-filename'`.

- [ ] **Step 3: Create the parser file**

Create `src/lib/onboarding/parse-filename.ts`:

```ts
export type ParsedLead = {
  date: string
  name: string
  address: string
  phone: string
  campaign: string
}

// Parses a cold-call audio filename in the BT Investments onboarding
// convention into the fields used to autofill a new lead. Returns null
// if the filename doesn't match the expected structure.
//
// Expected format:
//   "M.D <first> <last...> <age> - <address> - <phone> - <campaign>.ext"
// Example:
//   "6.7 John Doe 45 - 123 Main St Seattle WA - 555-1234 - Direct Mail.mp3"
//
// The date's year is set to the current calendar year — onboarding
// always happens within the same year as the cold call.
export function parseOnboardingFilename(filename: string): ParsedLead | null {
  const baseName = filename.replace(/\.[^/.]+$/, '')
  const parts = baseName.split(' - ')
  if (parts.length !== 4) return null

  const [leadInfo, address, phone, campaign] = parts
  const tokens = leadInfo.trim().split(/\s+/)
  if (tokens.length < 3) return null

  const datePart = tokens[0]
  const agePart = tokens[tokens.length - 1]
  const nameTokens = tokens.slice(1, -1)

  const dateMatch = datePart.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (!dateMatch) return null
  if (!/^\d+$/.test(agePart)) return null
  if (nameTokens.length === 0) return null

  const month = dateMatch[1].padStart(2, '0')
  const day = dateMatch[2].padStart(2, '0')
  const year = new Date().getFullYear()

  return {
    date: `${year}-${month}-${day}`,
    name: nameTokens.join(' '),
    address: address.trim(),
    phone: phone.trim(),
    campaign: campaign.trim(),
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- parse-filename.test.ts
```

Expected: 8/8 PASS.

- [ ] **Step 5: Remove the local copy from `LeadForm.tsx` and import the new one**

In `src/components/LeadForm.tsx`:

Replace lines 14-51 (the local `ParsedLead` type + `parseOnboardingFilename` function) with this single import added near the top of the file (after the existing imports):

```ts
import { parseOnboardingFilename, type ParsedLead } from '@/lib/onboarding/parse-filename'
```

Verify the file's other usages of `ParsedLead` and `parseOnboardingFilename` still resolve (they should, since the names are unchanged).

- [ ] **Step 6: Run the full test suite and type-check**

```bash
npm run test
npx tsc --noEmit
```

Expected: parse-filename tests pass. No new tsc errors (pre-existing failures in `investors.test.ts` and `.next/dev/types/validator.ts` are unrelated — leave them).

- [ ] **Step 7: Commit**

```bash
git add src/lib/onboarding/parse-filename.ts src/__tests__/lib/onboarding/parse-filename.test.ts src/components/LeadForm.tsx
git commit -m "Onboarding: extract parseOnboardingFilename into shared module"
```

---

## Task 2: Phone normalization helper

**Files:**
- Create: `src/lib/onboarding/normalize-phone.ts`
- Test: `src/__tests__/lib/onboarding/normalize-phone.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/onboarding/normalize-phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'

describe('normalizePhone', () => {
  it('strips spaces, dashes, parens, and dots', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567')
    expect(normalizePhone('555.123.4567')).toBe('5551234567')
    expect(normalizePhone('555 123 4567')).toBe('5551234567')
    expect(normalizePhone('555-123-4567')).toBe('5551234567')
  })

  it('keeps only the last 10 digits when a country code is present', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('5551234567')
    expect(normalizePhone('1-555-123-4567')).toBe('5551234567')
  })

  it('returns the digits unchanged when 10 or fewer', () => {
    expect(normalizePhone('5551234567')).toBe('5551234567')
    expect(normalizePhone('1234567')).toBe('1234567')
  })

  it('returns empty string for input with no digits', () => {
    expect(normalizePhone('not a phone')).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- normalize-phone.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the helper**

Create `src/lib/onboarding/normalize-phone.ts`:

```ts
// Strips a phone string to its bare digits for equality comparisons.
// Keeps the last 10 digits when a country code prefix is present so
// that "+1 555 123 4567" and "555-123-4567" normalize to the same key.

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D+/g, '')
  if (digits.length > 10) return digits.slice(-10)
  return digits
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm run test -- normalize-phone.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/normalize-phone.ts src/__tests__/lib/onboarding/normalize-phone.test.ts
git commit -m "Onboarding: add normalizePhone helper"
```

---

## Task 3: `getLeadIdsByPhones` server action

**Files:**
- Create: `src/actions/lead-lookup.ts`

- [ ] **Step 1: Write the server action**

Create `src/actions/lead-lookup.ts`:

```ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'
import type { ActionResult } from '@/lib/types'

// Returns a map from each input phone (normalized) to the matching
// active lead ID, if any. Used by the bulk onboarding preview to flag
// duplicates before creating new leads. Empty input → empty map.
//
// "Active" means archived = false on the lead record. Archived leads
// shouldn't block re-engagement.
export async function getLeadIdsByPhones(
  phones: string[],
): Promise<ActionResult<Record<string, string>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const normalizedToOriginal = new Map<string, string>()
    for (const p of phones) {
      const n = normalizePhone(p)
      if (n.length === 0) continue
      if (!normalizedToOriginal.has(n)) normalizedToOriginal.set(n, p)
    }

    if (normalizedToOriginal.size === 0) {
      return { success: true, data: {} }
    }

    const supabase = await createServerClient()

    // Pull every active lead's phones. The lead_phones table doesn't
    // store a normalized form, so we normalize in JS and match.
    const { data, error } = await supabase
      .from('lead_phones')
      .select('phone_number, lead_id, leads!inner(archived)')
      .eq('leads.archived', false)

    if (error) return { success: false, error: error.message }

    const result: Record<string, string> = {}
    for (const row of data ?? []) {
      const n = normalizePhone(row.phone_number as string)
      if (normalizedToOriginal.has(n) && !result[n]) {
        result[n] = row.lead_id as string
      }
    }

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "lead-lookup\.ts" || echo "no errors in lead-lookup.ts"
```

Expected: no errors in `lead-lookup.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/actions/lead-lookup.ts
git commit -m "Onboarding: add getLeadIdsByPhones for duplicate detection"
```

---

## Task 4: `+ Bulk Onboard` buttons + empty page shell

**Files:**
- Modify: `src/app/app/acquisitions/page.tsx`
- Modify: `src/app/app/acquisitions/all-leads/page.tsx`
- Create: `src/app/app/acquisitions/bulk-onboard/page.tsx`
- Create: `src/app/app/acquisitions/bulk-onboard/client.tsx`

- [ ] **Step 1: Add the sibling button to `acquisitions/page.tsx`**

In `src/app/app/acquisitions/page.tsx`, find the header `<div className="flex items-center gap-3">` block (around lines 48-56) and add a second `<Link>` immediately AFTER the existing `+ Onboarding` link:

```tsx
<Link
  href="/app/acquisitions/bulk-onboard"
  className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
>
  + Bulk Onboard
</Link>
```

The header should now contain (in order): `CallScriptViewer`, `+ Onboarding`, `+ Bulk Onboard`.

- [ ] **Step 2: Add the sibling button to `all-leads/page.tsx`**

In `src/app/app/acquisitions/all-leads/page.tsx`, find the existing `+ Onboarding` Link and add a sibling Link immediately after it with the exact same shape:

```tsx
<Link
  href="/app/acquisitions/bulk-onboard"
  className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
>
  + Bulk Onboard
</Link>
```

- [ ] **Step 3: Create the bulk-onboard server-component page**

Create `src/app/app/acquisitions/bulk-onboard/page.tsx`:

```tsx
import { AppBackLink } from '@/components/AppBackLink'
import { BulkOnboardClient } from './client'

export default function BulkOnboardPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bulk Onboarding</h1>
          <p className="text-sm text-neutral-600">
            Drop multiple properly-named audio files to create leads in batch
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <BulkOnboardClient />
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Create a placeholder client component**

Create `src/app/app/acquisitions/bulk-onboard/client.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'

export function BulkOnboardClient() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: File[]) {
    if (files.length === 0) return
    setPendingFiles((prev) => [...prev, ...files])
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
        }`}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-neutral-400 mb-2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-neutral-600">
          {isDragging ? 'Drop files here' : 'Drag & drop multiple audio files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Expected filename: M.D Name Age - Address - Phone - Campaign.ext
        </p>
      </div>

      {pendingFiles.length > 0 && (
        <p className="text-xs text-neutral-500">
          {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} queued — preview table coming next.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-onboard" || echo "no errors in bulk-onboard"
```

Expected: no errors in the new files.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/acquisitions/page.tsx src/app/app/acquisitions/all-leads/page.tsx src/app/app/acquisitions/bulk-onboard/
git commit -m "Bulk onboard: add entry-point buttons and empty page shell"
```

---

## Task 5: Preview table with parse + dedup

**Files:**
- Modify: `src/app/app/acquisitions/bulk-onboard/client.tsx`

- [ ] **Step 1: Replace the client with the full preview-table version**

Replace the entire contents of `src/app/app/acquisitions/bulk-onboard/client.tsx` with:

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { parseOnboardingFilename, type ParsedLead } from '@/lib/onboarding/parse-filename'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'
import { getLeadIdsByPhones } from '@/actions/lead-lookup'

type RowStatus =
  | { kind: 'parsed'; parsed: ParsedLead; selected: boolean; duplicateOfLeadId: string | null }
  | { kind: 'unparseable' }

type Row = {
  id: string
  file: File
  status: RowStatus
}

function rowId(file: File, index: number): string {
  return `${index}-${file.name}-${file.size}`
}

export function BulkOnboardClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isCheckingDupes, startDupeCheck] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: File[]) {
    if (files.length === 0) return

    const newRows: Row[] = files.map((file, i) => {
      const parsed = parseOnboardingFilename(file.name)
      if (!parsed) {
        return { id: rowId(file, rows.length + i), file, status: { kind: 'unparseable' } }
      }
      return {
        id: rowId(file, rows.length + i),
        file,
        status: {
          kind: 'parsed',
          parsed,
          selected: true,
          duplicateOfLeadId: null,
        },
      }
    })

    setRows((prev) => [...prev, ...newRows])
    runDupeCheck(newRows)
  }

  function runDupeCheck(newRows: Row[]) {
    const phonesToCheck = newRows
      .filter((r): r is Row & { status: { kind: 'parsed' } & ParsedLead } => r.status.kind === 'parsed')
      .map((r) => (r.status as { parsed: ParsedLead }).parsed.phone)

    if (phonesToCheck.length === 0) return

    startDupeCheck(async () => {
      const result = await getLeadIdsByPhones(phonesToCheck)
      if (!result.success) return
      const map = result.data
      setRows((prev) =>
        prev.map((r) => {
          if (r.status.kind !== 'parsed') return r
          const n = normalizePhone(r.status.parsed.phone)
          const dupId = map[n] ?? null
          if (!dupId) return r
          return {
            ...r,
            status: {
              ...r.status,
              selected: false, // duplicates default to unchecked
              duplicateOfLeadId: dupId,
            },
          }
        }),
      )
    })
  }

  function toggleSelected(rowId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId || r.status.kind !== 'parsed') return r
        return { ...r, status: { ...r.status, selected: !r.status.selected } }
      }),
    )
  }

  function clearAll() {
    setRows([])
  }

  const counts = {
    ready: rows.filter((r) => r.status.kind === 'parsed' && !r.status.duplicateOfLeadId).length,
    duplicate: rows.filter((r) => r.status.kind === 'parsed' && r.status.duplicateOfLeadId !== null).length,
    unparseable: rows.filter((r) => r.status.kind === 'unparseable').length,
  }
  const selectedCount = rows.filter((r) => r.status.kind === 'parsed' && r.status.selected).length

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            addFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-neutral-100'
        }`}
      >
        <p className="text-sm text-neutral-600">
          {isDragging ? 'Drop files here' : 'Drag & drop multiple audio files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Expected: M.D Name Age - Address - Phone - Campaign.ext
        </p>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div>
              ✅ {counts.ready} ready · ⚠️ {counts.duplicate} duplicate · ❌ {counts.unparseable} unparseable
              {isCheckingDupes && <span className="ml-2 text-neutral-400">(checking duplicates...)</span>}
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="text-neutral-500 underline hover:text-neutral-800"
            >
              Clear
            </button>
          </div>

          <ul className="divide-y divide-dashed divide-neutral-200 rounded border border-dashed border-neutral-300">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                {row.status.kind === 'unparseable' ? (
                  <>
                    <span className="text-lg leading-none">❌</span>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-700">{row.file.name}</p>
                      <p className="text-xs text-neutral-500">
                        Couldn&apos;t parse — expected M.D Name Age - Address - Phone - Campaign.ext
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={row.status.selected}
                      onChange={() => toggleSelected(row.id)}
                    />
                    <span className="text-lg leading-none">
                      {row.status.duplicateOfLeadId ? '⚠️' : '✅'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900">{row.status.parsed.name}</p>
                      <p className="text-xs text-neutral-600">
                        {row.status.parsed.address} · {row.status.parsed.phone} · {row.status.parsed.campaign} · {row.status.parsed.date}
                      </p>
                      {row.status.duplicateOfLeadId && (
                        <p className="text-xs text-amber-600">
                          Duplicate phone —{' '}
                          <Link
                            href={`/app/acquisitions/lead-record/${row.status.duplicateOfLeadId}`}
                            target="_blank"
                            className="underline hover:text-amber-800"
                          >
                            existing lead
                          </Link>
                          . Tick the box to onboard anyway.
                        </p>
                      )}
                      <p className="text-[0.65rem] text-neutral-400 truncate">{row.file.name}</p>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={selectedCount === 0}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50"
            >
              Create {selectedCount} lead{selectedCount === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-onboard" || echo "no tsc errors"
npm run lint 2>&1 | grep "bulk-onboard" || echo "no lint errors"
```

Expected: no errors in `bulk-onboard/client.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/bulk-onboard/client.tsx
git commit -m "Bulk onboard: preview table with parse + duplicate detection"
```

---

## Task 6: Create loop + results UI

**Files:**
- Modify: `src/app/app/acquisitions/bulk-onboard/client.tsx`

- [ ] **Step 1: Add the create logic to the client**

Open `src/app/app/acquisitions/bulk-onboard/client.tsx`. Make these changes:

**6.1** — Add imports near the top, just below the existing imports:

```ts
import { createLead } from '@/actions/leads'
import { createUpdate } from '@/actions/updates'
import { getUploadUrl, createAttachmentRecord } from '@/actions/attachments'
```

**6.2** — Extend the `RowStatus` union to support the "created" and "failed" outcomes. Replace the existing `RowStatus` type definition with:

```ts
type RowStatus =
  | { kind: 'parsed'; parsed: ParsedLead; selected: boolean; duplicateOfLeadId: string | null }
  | { kind: 'unparseable' }
  | { kind: 'created'; leadId: string; parsed: ParsedLead; attachmentError: string | null }
  | { kind: 'failed'; parsed: ParsedLead; error: string }
```

**6.3** — Add new state at the top of the component, right after the `isCheckingDupes` declaration:

```ts
const [isCreating, setIsCreating] = useState(false)
const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
```

**6.4** — Add a helper function inside the component (before the `return` statement):

```ts
async function uploadAttachment(
  leadId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updateRes = await createUpdate({
    entity_type: 'lead',
    entity_id: leadId,
    content: `[Audio recording: ${file.name}]`,
  })
  if (!updateRes.success) return { ok: false, error: updateRes.error }

  const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024
  if (file.size > DIRECT_UPLOAD_THRESHOLD) {
    const urlRes = await getUploadUrl(updateRes.data.id, 'lead', leadId, file.name, file.size)
    if (!urlRes.success) return { ok: false, error: urlRes.error }
    const putRes = await fetch(urlRes.data.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!putRes.ok) return { ok: false, error: `PUT failed (${putRes.status})` }
    const recRes = await createAttachmentRecord(
      updateRes.data.id,
      file.name,
      file.type || 'application/octet-stream',
      file.size,
      urlRes.data.path,
    )
    if (!recRes.success) return { ok: false, error: recRes.error }
    return { ok: true }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('updateId', updateRes.data.id)
  formData.append('entityType', 'lead')
  formData.append('entityId', leadId)
  const res = await fetch('/api/attachments/upload', { method: 'POST', body: formData })
  if (!res.ok) return { ok: false, error: `Upload failed (${res.status})` }
  return { ok: true }
}

async function createSelected() {
  const toCreate = rows.filter(
    (r) => r.status.kind === 'parsed' && r.status.selected,
  )
  if (toCreate.length === 0) return

  setIsCreating(true)
  setProgress({ done: 0, total: toCreate.length })

  for (let i = 0; i < toCreate.length; i++) {
    const row = toCreate[i]
    if (row.status.kind !== 'parsed') continue
    const { parsed, file } = { parsed: row.status.parsed, file: row.file }

    const createRes = await createLead({
      name: `🔷 ${parsed.name}`,
      date_converted: parsed.date,
      source_campaign_name: parsed.campaign,
      phones: [{ phone_number: parsed.phone, label: '', is_primary: true }],
      emails: [],
      properties: [{ address: parsed.address }],
    })

    if (!createRes.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: { kind: 'failed', parsed, error: createRes.error } }
            : r,
        ),
      )
      setProgress({ done: i + 1, total: toCreate.length })
      continue
    }

    const uploadRes = await uploadAttachment(createRes.data.id, file)

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: {
                kind: 'created',
                leadId: createRes.data.id,
                parsed,
                attachmentError: uploadRes.ok ? null : uploadRes.error,
              },
            }
          : r,
      ),
    )
    setProgress({ done: i + 1, total: toCreate.length })
  }

  setIsCreating(false)
}
```

**6.5** — Update the render to:
- Show the "Created" and "Failed" row states.
- Disable the dropzone and the create button while `isCreating`.
- Surface the progress text.
- Replace the existing `<button>...Create N leads</button>` with the new wiring + a post-run "Go to All Leads" link.

Replace the final `<div className="flex justify-end">` block (which contains the "Create N leads" button) with:

```tsx
<div className="flex items-center justify-between">
  {progress && (
    <p className="text-xs text-neutral-500">
      {isCreating
        ? `Creating ${progress.done + 1} of ${progress.total}...`
        : `Done: created ${rows.filter((r) => r.status.kind === 'created').length} of ${progress.total}. ${rows.filter((r) => r.status.kind === 'failed').length} failed.`}
    </p>
  )}
  <div className="flex items-center gap-3">
    {!isCreating &&
      rows.some((r) => r.status.kind === 'created') && (
        <Link
          href="/app/acquisitions/all-leads"
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          Go to All Leads
        </Link>
      )}
    <button
      type="button"
      onClick={createSelected}
      disabled={selectedCount === 0 || isCreating}
      className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50"
    >
      {isCreating ? 'Creating...' : `Create ${selectedCount} lead${selectedCount === 1 ? '' : 's'}`}
    </button>
  </div>
</div>
```

**6.6** — Update each row's rendering to show the `created` and `failed` states. Replace the existing row `<li>` body (the `row.status.kind === 'unparseable' ? <> : <>` ternary) with this expanded version:

```tsx
{row.status.kind === 'unparseable' && (
  <>
    <span className="text-lg leading-none">❌</span>
    <div className="flex-1">
      <p className="font-medium text-neutral-700">{row.file.name}</p>
      <p className="text-xs text-neutral-500">
        Couldn&apos;t parse — expected M.D Name Age - Address - Phone - Campaign.ext
      </p>
    </div>
  </>
)}
{row.status.kind === 'parsed' && (
  <>
    <input
      type="checkbox"
      className="mt-1"
      checked={row.status.selected}
      disabled={isCreating}
      onChange={() => toggleSelected(row.id)}
    />
    <span className="text-lg leading-none">
      {row.status.duplicateOfLeadId ? '⚠️' : '✅'}
    </span>
    <div className="flex-1">
      <p className="font-medium text-neutral-900">{row.status.parsed.name}</p>
      <p className="text-xs text-neutral-600">
        {row.status.parsed.address} · {row.status.parsed.phone} · {row.status.parsed.campaign} · {row.status.parsed.date}
      </p>
      {row.status.duplicateOfLeadId && (
        <p className="text-xs text-amber-600">
          Duplicate phone —{' '}
          <Link
            href={`/app/acquisitions/lead-record/${row.status.duplicateOfLeadId}`}
            target="_blank"
            className="underline hover:text-amber-800"
          >
            existing lead
          </Link>
          . Tick the box to onboard anyway.
        </p>
      )}
      <p className="text-[0.65rem] text-neutral-400 truncate">{row.file.name}</p>
    </div>
  </>
)}
{row.status.kind === 'created' && (
  <>
    <span className="text-lg leading-none">✅</span>
    <div className="flex-1">
      <p className="font-medium text-neutral-900">
        <Link
          href={`/app/acquisitions/lead-record/${row.status.leadId}`}
          target="_blank"
          className="underline hover:text-neutral-700"
        >
          {row.status.parsed.name}
        </Link>{' '}
        <span className="text-xs text-emerald-600">created</span>
      </p>
      {row.status.attachmentError && (
        <p className="text-xs text-amber-600">
          Audio upload failed: {row.status.attachmentError}. Open the lead to re-upload manually.
        </p>
      )}
    </div>
  </>
)}
{row.status.kind === 'failed' && (
  <>
    <span className="text-lg leading-none">❌</span>
    <div className="flex-1">
      <p className="font-medium text-neutral-900">{row.status.parsed.name}</p>
      <p className="text-xs text-red-600">Create failed: {row.status.error}</p>
    </div>
  </>
)}
```

**6.7** — Disable the dropzone while creating. In the dropzone `<div>`, wrap the `onClick` so it's a no-op when `isCreating`:

Find:
```tsx
onClick={() => fileInputRef.current?.click()}
```

Replace with:
```tsx
onClick={() => { if (!isCreating) fileInputRef.current?.click() }}
```

Also add `aria-disabled={isCreating}` to the same `<div>`.

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-onboard" || echo "no tsc errors"
npm run lint 2>&1 | grep "bulk-onboard" || echo "no lint errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/bulk-onboard/client.tsx
git commit -m "Bulk onboard: sequential create loop with per-row results"
```

---

## Task 7: "Retry failed" button

**Files:**
- Modify: `src/app/app/acquisitions/bulk-onboard/client.tsx`

- [ ] **Step 1: Add the retry handler and button**

Open `src/app/app/acquisitions/bulk-onboard/client.tsx`.

**7.1** — Refactor `createSelected` so it can also be called with a subset. Replace the existing `createSelected` with this overloaded version:

Find:
```ts
async function createSelected() {
  const toCreate = rows.filter(
    (r) => r.status.kind === 'parsed' && r.status.selected,
  )
  if (toCreate.length === 0) return
```

Replace with:
```ts
async function processRows(filterPredicate: (r: Row) => boolean) {
  const toCreate = rows.filter(filterPredicate)
  if (toCreate.length === 0) return
```

Then find the closing brace of `createSelected` (right before the empty `setIsCreating(false)` line at the function's end... actually the entire body remains the same, just renamed). Confirm the function ends with `setIsCreating(false)` and has no other return.

Add two wrappers below the renamed `processRows`:

```ts
async function createSelected() {
  await processRows((r) => r.status.kind === 'parsed' && r.status.selected)
}

async function retryFailed() {
  // Convert each `failed` row back to `parsed` + selected, then run.
  setRows((prev) =>
    prev.map((r) =>
      r.status.kind === 'failed'
        ? {
            ...r,
            status: {
              kind: 'parsed',
              parsed: r.status.parsed,
              selected: true,
              duplicateOfLeadId: null,
            },
          }
        : r,
    ),
  )
  // Wait a tick for setRows to flush, then process the just-reset rows.
  setTimeout(() => {
    processRows((r) => r.status.kind === 'parsed' && r.status.selected)
  }, 0)
}
```

**7.2** — Add the Retry button next to "Go to All Leads". Find the existing `{!isCreating && rows.some((r) => r.status.kind === 'created') && (` block and add a sibling for failed rows:

```tsx
{!isCreating &&
  rows.some((r) => r.status.kind === 'failed') && (
    <button
      type="button"
      onClick={retryFailed}
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100"
    >
      Retry failed
    </button>
  )}
```

Place it inside the same flex container as the Go to All Leads link and the Create button, between them.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-onboard" || echo "no tsc errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/acquisitions/bulk-onboard/client.tsx
git commit -m "Bulk onboard: add Retry failed action"
```

---

## Task 8: Manual verification

**Goal:** Confirm end-to-end on the deployed site (or `npm run dev` locally).

- [ ] **Step 1: Start dev server**

```bash
cd "/Users/groovehouseent/Desktop/Bt Investments App Development/bt-investments"
npm run dev
```

Open `http://localhost:3000/app/acquisitions`.

- [ ] **Step 2: Confirm the button is present**

In the acquisitions header you should see (left to right): `Call Script`, `+ Onboarding`, `+ Bulk Onboard`. Click `+ Bulk Onboard` — should navigate to `/app/acquisitions/bulk-onboard`.

- [ ] **Step 3: Drop a valid file**

Drop one properly-named audio file (e.g. `6.7 Test Lead 45 - 123 Fake St - 555-9999 - Direct Mail.mp3` — touch a small mp3 if needed). Expect:
- Row appears with ✅
- Name = "Test Lead", Address = "123 Fake St", Phone = "555-9999", Campaign = "Direct Mail", Date = "2026-06-07"
- Counts: "✅ 1 ready · ⚠️ 0 duplicate · ❌ 0 unparseable"
- "Create 1 lead" button enabled

- [ ] **Step 4: Drop an unparseable file**

Drop a randomly-named file (e.g. `recording.mp3`). Expect:
- Row appears with ❌ and a hint about the expected format
- No checkbox
- Counts update to "✅ 1 ready · ⚠️ 0 duplicate · ❌ 1 unparseable"
- Selected count still 1

- [ ] **Step 5: Drop a duplicate**

Take one of your existing leads, find its phone, and create a filename with that phone (e.g. `6.7 Real Person 50 - 1 Real St - <existing_phone> - Email.mp3`). Expect:
- Row appears with ⚠️
- Checkbox unchecked
- "Duplicate phone — existing lead" link shown, clicking opens the existing lead record in a new tab
- Selected count unchanged (this row isn't selected)

- [ ] **Step 6: Click Create**

With the ✅ row selected, click "Create 1 lead". Expect:
- Button shows "Creating..."
- Within a few seconds, row updates to ✅ with a "Test Lead created" link
- Bottom shows "Done: created 1 of 1. 0 failed."
- "Go to All Leads" link appears
- Click the new lead — confirm the audio file is attached as an "Audio recording: ..." update

- [ ] **Step 7: Force a failure and retry**

To force a failure, intentionally pre-create a lead with name including a unique marker, drop a file with an address that's > 1024 chars (or whatever the DB cap is — check `leads` schema if you want a specific failure), let it fail, then click "Retry failed" and confirm it re-runs that row.

Alternative if no easy failure trigger: kill the dev server mid-create to force an error → confirm the failed row appears with a red error message.

- [ ] **Step 8: Clear and re-drop**

Click "Clear". Confirm the table empties and you can drop new files. Confirm dropping while a previous create-batch is still running is impossible (the dropzone is disabled with `aria-disabled`).

---

## Self-Review

**Spec coverage check:**
- New "+ Bulk Onboard" button next to "+ Onboarding" on two pages → Task 4
- New page at `/app/acquisitions/bulk-onboard` → Task 4
- Multi-file dropzone → Task 4 (initial) + Task 5 (refined)
- Preview table with ✅/⚠️/❌ states → Task 5
- Duplicate-by-phone check with `getLeadIdsByPhones` → Task 3 (action) + Task 5 (client uses it)
- Sequential `createLead` + attachment upload per row → Task 6
- Per-row failure handling (continue, mark, retry) → Task 6 + Task 7
- "Retry failed" action → Task 7
- "Clear" + "Go to All Leads" → Task 5 (clear) + Task 6 (Go to All Leads)
- Lock dropzone while creating → Task 6 (step 6.7)
- Defensive re-check duplicate before create → SPEC says "Called again per row right before the actual createLead" — this is NOT implemented in the current plan; the dup check runs once at drop time. Decision: skip the per-row recheck for now (YAGNI — Randy's working alone in single tabs). If it becomes a real issue, add later. Noting this as an intentional deviation from the spec.
- Tests for parser → Task 1
- Tests for phone normalization → Task 2
- Manual verification → Task 8

**Placeholder scan:** no TBD, no "implement later", every step has complete code or a literal command. ✓

**Type consistency check:**
- `ParsedLead` type imported from `@/lib/onboarding/parse-filename` in both LeadForm (Task 1) and bulk client (Task 5). ✓
- `normalizePhone(s) → string` signature consistent across Task 2 (definition), Task 3 (server-action use), Task 5 (client use). ✓
- `getLeadIdsByPhones(phones: string[]) → ActionResult<Record<string, string>>` — defined in Task 3, used in Task 5 with the same shape. ✓
- `Row` and `RowStatus` types — defined in Task 5, extended (additively) in Task 6.2 with new union variants. No conflicting redefinition. ✓
- `createLead` input shape — matches the existing `createLeadSchema` per Task 6 (phones include `phone_number`, `label`, `is_primary`; properties include `address`). ✓
- `createSelected` → renamed to `processRows` in Task 7 with the same body. Both `createSelected` and `retryFailed` are added as wrappers. ✓

Plan is internally consistent and ready to execute.
