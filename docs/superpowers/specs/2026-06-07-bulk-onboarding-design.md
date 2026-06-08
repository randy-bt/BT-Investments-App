# Bulk Onboarding — Design

**Status:** Approved, proceed to implementation plan
**Date:** 2026-06-07

## Goal

Let Randy drop multiple properly-named audio files (cold-call recordings) at once and onboard each as its own lead record — instead of dropping them one at a time on `/app/acquisitions/new-lead`.

## Out of scope

- Transcribing the audio (these are just filename-driven).
- Changing the existing single-lead flow at `/app/acquisitions/new-lead` — stays untouched.
- Changing the filename convention or the parser (`parseOnboardingFilename` in `src/components/LeadForm.tsx`).

## UI

**Entry button.** A `+ Bulk Onboard` button placed next to the existing `+ Onboarding` button in two headers:
- `src/app/app/acquisitions/page.tsx`
- `src/app/app/acquisitions/all-leads/page.tsx`

Same sage-tinted styling as the existing button. Links to a new page `/app/acquisitions/bulk-onboard`.

**Bulk onboard page** (`/app/acquisitions/bulk-onboard`):
- Same shell as `new-lead/page.tsx` — `Bulk Onboarding` title, dashed-border card.
- Multi-file dropzone (reuses the same drag-and-drop styling as the existing single-lead dropzone).
- Below dropzone: a preview table that appears once files are dropped.
- Above the table: header strip with running counts — `✅ N ready · ⚠️ M duplicate · ❌ K unparseable`.
- Below the table: `Create N leads` button (disabled when N = 0), `Clear` button.

## Preview-table row states

Each dropped file produces one row. Three states:

| Icon | State | Default checkbox | Row content |
|---|---|---|---|
| ✅ | Parsed cleanly | checked | Name, address, phone, campaign, date |
| ⚠️ | Duplicate phone (already a lead) | unchecked | Parsed fields + link to existing lead record |
| ❌ | Couldn't parse | n/a (disabled) | Filename + hint about the expected format |

User can uncheck any ✅ row or opt-in any ⚠️ row before clicking the create button.

## Create flow

Sequential, one lead at a time:

1. For each selected row:
   1. `createLead(...)` with the fields populated from the parsed filename (name with `🔷` prefix, `date_converted`, `source_campaign_name`, single property with address, single primary phone). All other lead fields left blank — Randy fills them in later by clicking into the record.
   2. On success: upload the audio file to Supabase Storage via the existing pattern (`getUploadUrl` → `fetch PUT` → `createAttachmentRecord`).
   3. On `createLead` failure: mark the row as ❌ failed with the error message, continue to the next.
   4. On attachment failure: keep the lead, mark the row "created but attachment failed", continue.
2. After the loop:
   - Progress text: `Created X of N. Y failed.`
   - Each row shows its final state (✅ with link to the new lead, or ❌ with error).
   - Buttons: `Go to All Leads`, plus `Retry failed` if any rows failed.
   - Dropzone is locked until `Clear` is clicked.

## Duplicate check

New server action `getLeadIdsByPhones(phones: string[])`:
- Normalizes each phone (strip non-digits) and queries `lead_phones` joined to `leads`, filtered to non-archived.
- Returns a `Map<normalizedPhone, leadId>` for matches.
- Called once after drop to populate the ⚠️ state. Called again per row right before the actual `createLead` (defensive — Randy might have created a lead in another tab).

## Failure handling

- One row's failure never bails out the batch.
- Per-row errors are captured and displayed inline in the table after the loop.
- `Retry failed` re-runs just the ❌ rows.

## Files to create / modify

- **Create:** `src/app/app/acquisitions/bulk-onboard/page.tsx` — server-component shell.
- **Create:** `src/app/app/acquisitions/bulk-onboard/client.tsx` — the dropzone + preview table + create loop.
- **Create:** `src/actions/lead-lookup.ts` (or extend `src/actions/entity-lookup.ts`) — exports `getLeadIdsByPhones(phones)`.
- **Extract:** `parseOnboardingFilename` from `src/components/LeadForm.tsx` into `src/lib/onboarding/parse-filename.ts` so both single and bulk flows import the same parser. Update `LeadForm` to import from the new location.
- **Modify:** `src/app/app/acquisitions/page.tsx` — add the second button in the header.
- **Modify:** `src/app/app/acquisitions/all-leads/page.tsx` — add the second button in the header.

## Testing

- `src/__tests__/lib/onboarding/parse-filename.test.ts` — preserve existing parser behavior in its new home (happy path + the three failure modes — wrong split count, bad date, missing age).
- `src/__tests__/actions/lead-lookup.test.ts` — `getLeadIdsByPhones` normalization (strips dashes/spaces/parens), only returns active leads, returns empty map when no matches.

Manual verification on the live site after deploy:
1. Drop one file with a valid filename → row shows ✅, click create → lead appears in All Leads with audio attached.
2. Drop one file with broken filename → row shows ❌ disabled.
3. Drop two files with the same phone as an existing lead → both ⚠️ with link to the existing lead.
4. Drop 5 files where one will fail server-side (manually break one, e.g. mismatched date) → other 4 succeed, the failed one shows ❌ with error, Retry failed re-runs just that one.

## Rollout

Single deploy. No DB migration. Backwards compatible — existing single-lead flow untouched.
