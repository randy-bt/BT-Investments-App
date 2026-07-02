'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { generateAgreementPdf, getDocTitle } from '@/lib/google-docs'
import { runDeterministicChecks, type AgreementReview } from '@/lib/agreements/review'
import { aiReviewAgreement } from '@/lib/agreements/ai-review'
import { buildAgreementFilename } from '@/lib/agreements/filename'
import type {
  ActionResult,
  AgreementTemplate,
  AgreementVariable,
  GeneratedAgreement,
  Lead,
  Property,
  LeadPhone,
  LeadEmail,
} from '@/lib/types'

const BUCKET = 'agreements'

// ---- Templates ----

export async function listAgreementTemplates(opts: { includeInactive?: boolean } = {}): Promise<
  ActionResult<AgreementTemplate[]>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    let query = supabase.from('agreement_templates').select('*').order('name')
    if (!opts.includeInactive) query = query.eq('active', true)

    const { data, error } = await query
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as AgreementTemplate[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getAgreementTemplate(id: string): Promise<ActionResult<AgreementTemplate>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agreement_templates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as AgreementTemplate }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createAgreementTemplate(input: {
  name: string
  agreement_type: string
  google_doc_id: string
  variables: AgreementVariable[]
}): Promise<ActionResult<AgreementTemplate>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    // Verify the service account can access the doc before saving
    try {
      await getDocTitle(input.google_doc_id)
    } catch {
      return {
        success: false,
        error:
          "Can't access that Google Doc. Make sure you shared it with the service account as Viewer.",
      }
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agreement_templates')
      .insert({
        name: input.name,
        agreement_type: input.agreement_type,
        google_doc_id: input.google_doc_id,
        variables: input.variables,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as AgreementTemplate }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateAgreementTemplate(
  id: string,
  input: Partial<{
    name: string
    agreement_type: string
    google_doc_id: string
    variables: AgreementVariable[]
    active: boolean
  }>
): Promise<ActionResult<AgreementTemplate>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (input.google_doc_id) {
      try {
        await getDocTitle(input.google_doc_id)
      } catch {
        return {
          success: false,
          error:
            "Can't access that Google Doc. Make sure you shared it with the service account as Viewer.",
        }
      }
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agreement_templates')
      .update({ ...input, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as AgreementTemplate }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteAgreementTemplate(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    // Soft delete so historical generated_agreements retain the link
    const { error } = await supabase
      .from('agreement_templates')
      .update({ active: false, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---- Autofill ----

// Small list of a lead's properties so the agreement form can offer a
// property picker when a lead has more than one (autofill otherwise
// silently used the first/oldest property).
export async function listLeadProperties(
  leadId: string
): Promise<ActionResult<{ id: string; address: string | null }[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('properties')
      .select('id, address')
      .eq('lead_id', leadId)
      .order('created_at')
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as { id: string; address: string | null }[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Build a snake_case values map from a lead + its primary property/phone/email.
// Keys match the placeholders documented in the UI. Pass propertyId to autofill
// from a specific property (multi-property leads); defaults to the oldest.
export async function getLeadAutofillValues(
  leadId: string,
  propertyId?: string
): Promise<ActionResult<Record<string, string>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    let propsQuery = supabase.from('properties').select('*').eq('lead_id', leadId)
    propsQuery = propertyId
      ? propsQuery.eq('id', propertyId)
      : propsQuery.order('created_at').limit(1)
    const [leadRes, phonesRes, emailsRes, propsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).single(),
      supabase.from('lead_phones').select('*').eq('lead_id', leadId).order('is_primary', { ascending: false }),
      supabase.from('lead_emails').select('*').eq('lead_id', leadId).order('is_primary', { ascending: false }),
      propsQuery,
    ])
    if (leadRes.error) return { success: false, error: leadRes.error.message }

    const lead = leadRes.data as Lead
    const property = (propsRes.data?.[0] ?? null) as Property | null
    const primaryPhone = ((phonesRes.data ?? []) as LeadPhone[])[0]
    const primaryEmail = ((emailsRes.data ?? []) as LeadEmail[])[0]

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
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---- Generation ----

export async function generateAgreement(input: {
  template_id: string
  lead_id: string | null
  values: Record<string, string | boolean>
}): Promise<ActionResult<GeneratedAgreement>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Load template
    const { data: template, error: tErr } = await supabase
      .from('agreement_templates')
      .select('*')
      .eq('id', input.template_id)
      .single()
    if (tErr || !template) return { success: false, error: tErr?.message ?? 'Template not found' }
    const tpl = template as AgreementTemplate

    // Load lead/property for filename + archive linkage
    let leadName = ''
    let address = ''
    let propertyId: string | null = null
    if (input.lead_id) {
      const { data: lead } = await supabase.from('leads').select('name').eq('id', input.lead_id).single()
      if (lead) leadName = (lead as { name: string }).name
      const { data: props } = await supabase
        .from('properties')
        .select('id, address')
        .eq('lead_id', input.lead_id)
        .order('created_at')
        .limit(1)
      if (props && props.length > 0) {
        propertyId = (props[0] as { id: string }).id
        address = (props[0] as { address: string }).address
      }
    }

    // Contract version: V1 for the first draft, V2 for the next draft of the
    // same agreement type for the same lead, and so on.
    let version = 1
    if (input.lead_id) {
      const { count } = await supabase
        .from('generated_agreements')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', input.lead_id)
        .eq('agreement_type', tpl.agreement_type)
      version = (count ?? 0) + 1
    }

    // Stringify all values for Docs API (booleans → "Yes"/"No" by default; checkboxes
    // usually drive conditional keys rather than literal output).
    const stringValues: Record<string, string> = {}
    for (const [k, v] of Object.entries(input.values)) {
      stringValues[k] = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v
    }

    // Generate PDF via Google Docs API (returns the final doc text too)
    const { pdf: pdfBuffer, filledText } = await generateAgreementPdf(
      tpl.google_doc_id,
      stringValues
    )

    // Automated pre-send review: mechanical checks (blanks, unchecked
    // sections, date order, price math, leftover placeholders) + an AI
    // read of the final contract. AI layer is best-effort; the checks
    // always run. Stored with the agreement and shown on the create page.
    const deterministicIssues = runDeterministicChecks(tpl.variables, stringValues, filledText)
    const ai = await aiReviewAgreement({
      templateName: tpl.name,
      filledText,
      values: stringValues,
    })
    const review: AgreementReview = {
      issues: [...deterministicIssues, ...ai.issues],
      ai_ok: ai.ok,
      reviewed_at: new Date().toISOString(),
    }

    // Upload to Supabase Storage (service role to bypass RLS uniformly)
    const filename = buildAgreementFilename({
      agreementType: tpl.agreement_type,
      address,
      leadName,
      version,
    })
    const storagePath = `${new Date().getFullYear()}/${Date.now()}-${filename}`
    const admin = createAdminClient()
    const uploadRes = await admin.storage
      .from(BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false })
    if (uploadRes.error) return { success: false, error: uploadRes.error.message }

    // Record in archive
    const { data: inserted, error: iErr } = await supabase
      .from('generated_agreements')
      .insert({
        template_id: tpl.id,
        template_name: tpl.name,
        agreement_type: tpl.agreement_type,
        lead_id: input.lead_id,
        property_id: propertyId,
        filename,
        storage_path: storagePath,
        variables_used: input.values,
        review,
        version,
        created_by: user.id,
      })
      .select()
      .single()
    if (iErr) return { success: false, error: iErr.message }
    return { success: true, data: inserted as GeneratedAgreement }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---- Archive ----

export async function listGeneratedAgreements(
  opts: { active: boolean } = { active: true }
): Promise<ActionResult<GeneratedAgreement[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('generated_agreements')
      .select('*, lead:leads!lead_id(name)')
      .eq('is_active', opts.active)
      .order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const { lead, ...rest } = r
      return {
        ...rest,
        lead_name: (lead as { name?: string } | null)?.name ?? null,
      }
    })
    return { success: true, data: rows as GeneratedAgreement[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Signed URL WITHOUT the download disposition, so the browser renders
// the PDF inline (used by the "Open in new tab" action). Returns the
// same kind of short-lived signed URL as the download variant.
export async function getAgreementViewUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data: row, error } = await supabase
      .from('generated_agreements')
      .select('storage_path')
      .eq('id', id)
      .single()
    if (error || !row) return { success: false, error: error?.message ?? 'Not found' }

    const admin = createAdminClient()
    const { data: signed, error: sErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl((row as { storage_path: string }).storage_path, 60 * 5)
    if (sErr || !signed) return { success: false, error: sErr?.message ?? 'Signed URL failed' }
    return { success: true, data: signed.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Rename the display filename on a generated agreement row. Does NOT
// rename the underlying storage object — only the database label that
// appears in the table and the download Content-Disposition.
export async function renameGeneratedAgreement(
  id: string,
  newFilename: string,
): Promise<ActionResult<GeneratedAgreement>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const trimmed = newFilename.trim()
    if (!trimmed) return { success: false, error: 'Filename cannot be empty.' }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('generated_agreements')
      .update({ filename: trimmed })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as GeneratedAgreement }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getAgreementDownloadUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data: row, error } = await supabase
      .from('generated_agreements')
      .select('storage_path, filename')
      .eq('id', id)
      .single()
    if (error || !row) return { success: false, error: error?.message ?? 'Not found' }
    const r = row as { storage_path: string; filename: string }

    const admin = createAdminClient()
    // Pass the filename as the `download` option so Supabase returns a
    // Content-Disposition: attachment header — forces the browser to
    // save the file instead of trying to render inline. Inline viewing
    // misbehaved on iOS / certain Android builds, producing the tiny
    // ~90-byte file the user saw.
    const { data: signed, error: sErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, 60 * 5, { download: r.filename })
    if (sErr || !signed) return { success: false, error: sErr?.message ?? 'Signed URL failed' }
    return { success: true, data: signed.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteGeneratedAgreement(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data: row, error } = await supabase
      .from('generated_agreements')
      .select('storage_path')
      .eq('id', id)
      .single()
    if (error || !row) return { success: false, error: error?.message ?? 'Not found' }

    const admin = createAdminClient()
    await admin.storage.from(BUCKET).remove([(row as { storage_path: string }).storage_path])
    const { error: dErr } = await supabase.from('generated_agreements').delete().eq('id', id)
    if (dErr) return { success: false, error: dErr.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function archiveGeneratedAgreement(id: string): Promise<ActionResult<null>> {
  return setAgreementActive(id, false)
}

export async function unarchiveGeneratedAgreement(id: string): Promise<ActionResult<null>> {
  return setAgreementActive(id, true)
}

async function setAgreementActive(id: string, isActive: boolean): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('generated_agreements')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Lightweight list of leads for the generate dropdown
export async function listLeadsForAgreement(): Promise<
  ActionResult<{ id: string; name: string; address: string | null }[]>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, properties(address)')
      .order('name')
    if (error) return { success: false, error: error.message }
    const items = (data ?? []).map((row: Record<string, unknown>) => {
      const properties = row.properties as { address: string }[] | null
      return {
        id: row.id as string,
        name: row.name as string,
        address: properties?.[0]?.address ?? null,
      }
    })
    return { success: true, data: items }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
