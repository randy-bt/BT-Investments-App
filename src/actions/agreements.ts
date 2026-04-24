'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { generateAgreementPdf, getDocTitle } from '@/lib/google-docs'
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

// Build a snake_case values map from a lead + its primary property/phone/email.
// Keys match the placeholders documented in the UI.
export async function getLeadAutofillValues(
  leadId: string
): Promise<ActionResult<Record<string, string>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const [leadRes, phonesRes, emailsRes, propsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).single(),
      supabase.from('lead_phones').select('*').eq('lead_id', leadId).order('is_primary', { ascending: false }),
      supabase.from('lead_emails').select('*').eq('lead_id', leadId).order('is_primary', { ascending: false }),
      supabase.from('properties').select('*').eq('lead_id', leadId).order('created_at').limit(1),
    ])
    if (leadRes.error) return { success: false, error: leadRes.error.message }

    const lead = leadRes.data as Lead
    const property = (propsRes.data?.[0] ?? null) as Property | null
    const primaryPhone = ((phonesRes.data ?? []) as LeadPhone[])[0]
    const primaryEmail = ((emailsRes.data ?? []) as LeadEmail[])[0]

    const values: Record<string, string> = {
      lead_name: lead.name ?? '',
      lead_mailing_address: lead.mailing_address ?? '',
      lead_occupancy_status: lead.occupancy_status ?? '',
      lead_asking_price: lead.asking_price ?? '',
      lead_our_current_offer: lead.our_current_offer != null ? String(lead.our_current_offer) : '',
      lead_range: lead.range ?? '',
      lead_selling_timeline: lead.selling_timeline ?? '',
      lead_condition: lead.condition ?? '',
      lead_emd_date: lead.emd_date ?? '',
      lead_closing_date: lead.closing_date ?? '',
      lead_primary_phone: primaryPhone?.phone_number ?? '',
      lead_primary_email: primaryEmail?.email ?? '',
      property_address: property?.address ?? '',
      property_apn: property?.apn ?? '',
      property_county: property?.county ?? '',
      property_zoning: property?.zoning ?? '',
      property_legal_description: property?.legal_description ?? '',
      property_year_built: property?.year_built != null ? String(property.year_built) : '',
      property_bedrooms: property?.bedrooms != null ? String(property.bedrooms) : '',
      property_bathrooms: property?.bathrooms != null ? String(property.bathrooms) : '',
      property_sqft: property?.sqft != null ? String(property.sqft) : '',
      property_lot_size: property?.lot_size ?? '',
      property_property_type: property?.property_type ?? '',
      property_owner_name: property?.owner_name ?? '',
      property_owner_mailing_address: property?.owner_mailing_address ?? '',
    }
    return { success: true, data: values }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---- Generation ----

// Build the final filename: "BT Investments - [House #] [City] - [Type] - Sign.pdf"
// Falls back to lead name when no parseable street/city is present.
function buildFilename(agreementType: string, address: string, leadName: string): string {
  const safeType = agreementType.replace(/[\\/:*?"<>|]/g, '').trim()
  const parts = (address || '').split(',').map((s) => s.trim())
  const street = parts[0] ?? ''
  const city = parts[1] ?? ''
  const houseNumberMatch = street.match(/^(\d+)/)
  const houseNumber = houseNumberMatch ? houseNumberMatch[1] : ''
  const subject = [houseNumber, city].filter(Boolean).join(' ') || leadName || 'Agreement'
  return `BT Investments - ${subject} - ${safeType} - Sign.pdf`
}

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
    let leadName = 'Agreement'
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

    // Stringify all values for Docs API (booleans → "Yes"/"No" by default; checkboxes
    // usually drive conditional keys rather than literal output).
    const stringValues: Record<string, string> = {}
    for (const [k, v] of Object.entries(input.values)) {
      stringValues[k] = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v
    }

    // Generate PDF via Google Docs API
    const pdfBuffer = await generateAgreementPdf(tpl.google_doc_id, stringValues)

    // Upload to Supabase Storage (service role to bypass RLS uniformly)
    const filename = buildFilename(tpl.agreement_type, address, leadName)
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

export async function listGeneratedAgreements(): Promise<ActionResult<GeneratedAgreement[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('generated_agreements')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as GeneratedAgreement[] }
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
