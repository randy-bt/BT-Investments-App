'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createLeadSchema, updateLeadSchema, changeLeadStageSchema } from '@/lib/validations/leads'
import { leadPhoneSchema, leadEmailSchema } from '@/lib/validations/leads'
import type { ActionResult, Lead, LeadWithRelations, LeadStage, PaginationParams, PaginatedResult, EntityStatus, LeadPhone, LeadEmail } from '@/lib/types'

export async function getLeads(
  params: PaginationParams & { status?: EntityStatus; stage?: LeadStage } = {}
): Promise<ActionResult<PaginatedResult<Lead>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50, status, stage } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    let query = supabase.from('leads').select('*', { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { items: data as Lead[], total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLead(id: string): Promise<ActionResult<LeadWithRelations>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const [leadRes, phonesRes, emailsRes, propsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('lead_phones').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('lead_emails').select('*').eq('lead_id', id).order('created_at'),
      supabase.from('properties').select('*').eq('lead_id', id).order('created_at'),
    ])

    if (leadRes.error) return { success: false, error: leadRes.error.message }

    return {
      success: true,
      data: {
        ...(leadRes.data as Lead),
        phones: (phonesRes.data ?? []) as LeadPhone[],
        emails: (emailsRes.data ?? []) as LeadEmail[],
        properties: propsRes.data ?? [],
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createLead(input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createLeadSchema.parse(input)
    const supabase = await createServerClient()

    // Insert lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: validated.name,
        mailing_address: validated.mailing_address,
        occupancy_status: validated.occupancy_status,
        asking_price: validated.asking_price,
        selling_timeline: validated.selling_timeline,
        source_campaign_name: validated.source_campaign_name,
        handoff_notes: validated.handoff_notes,
        date_converted: validated.date_converted,
        created_by: user.id,
      })
      .select()
      .single()

    if (leadError) return { success: false, error: leadError.message }

    // Insert phones
    if (validated.phones.length > 0) {
      await supabase.from('lead_phones').insert(
        validated.phones.map((p) => ({ ...p, lead_id: lead.id }))
      )
    }

    // Insert emails
    if (validated.emails && validated.emails.length > 0) {
      await supabase.from('lead_emails').insert(
        validated.emails.map((e) => ({ ...e, lead_id: lead.id }))
      )
    }

    // Insert properties
    if (validated.properties.length > 0) {
      await supabase.from('properties').insert(
        validated.properties.map((p) => ({ ...p, lead_id: lead.id }))
      )
    }

    return { success: true, data: lead as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateLead(id: string, input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updateLeadSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('leads')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function changeLeadStage(id: string, input: unknown): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = changeLeadStageSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('leads')
      .update({ stage: validated.stage })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function archiveLead(id: string): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'closed' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Admin-only: reopening is a significant state change (same logic as archiving)
export async function reopenLead(id: string): Promise<ActionResult<Lead>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('leads')
      .update({ status: 'active' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Lead }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addLeadPhone(leadId: string, input: unknown): Promise<ActionResult<LeadPhone>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = leadPhoneSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('lead_phones')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as LeadPhone }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeLeadPhone(phoneId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addLeadEmail(leadId: string, input: unknown): Promise<ActionResult<LeadEmail>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = leadEmailSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('lead_emails')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as LeadEmail }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeLeadEmail(emailId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('lead_emails').delete().eq('id', emailId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
