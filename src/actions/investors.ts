'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createInvestorSchema, updateInvestorSchema, investorPhoneSchema, investorEmailSchema } from '@/lib/validations/investors'
import type { ActionResult, Investor, InvestorWithRelations, InvestorPhone, InvestorEmail, PaginationParams, PaginatedResult, EntityStatus } from '@/lib/types'

export async function getInvestors(
  params: PaginationParams & { status?: EntityStatus } = {}
): Promise<ActionResult<PaginatedResult<Investor>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50, status } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    let query = supabase.from('investors').select('*', { count: 'exact' })

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { items: data as Investor[], total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getInvestor(id: string): Promise<ActionResult<InvestorWithRelations>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const [investorRes, phonesRes, emailsRes] = await Promise.all([
      supabase.from('investors').select('*').eq('id', id).single(),
      supabase.from('investor_phones').select('*').eq('investor_id', id).order('created_at'),
      supabase.from('investor_emails').select('*').eq('investor_id', id).order('created_at'),
    ])

    if (investorRes.error) return { success: false, error: investorRes.error.message }

    return {
      success: true,
      data: {
        ...(investorRes.data as Investor),
        phones: (phonesRes.data ?? []) as InvestorPhone[],
        emails: (emailsRes.data ?? []) as InvestorEmail[],
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createInvestor(input: unknown): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createInvestorSchema.parse(input)
    const supabase = await createServerClient()

    const { data: investor, error } = await supabase
      .from('investors')
      .insert({
        name: validated.name,
        company: validated.company,
        locations_of_interest: validated.locations_of_interest,
        deals_notes: validated.deals_notes,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }

    // Insert phones
    if (validated.phones && validated.phones.length > 0) {
      await supabase.from('investor_phones').insert(
        validated.phones.map((p) => ({ ...p, investor_id: investor.id }))
      )
    }

    // Insert emails
    if (validated.emails && validated.emails.length > 0) {
      await supabase.from('investor_emails').insert(
        validated.emails.map((e) => ({ ...e, investor_id: investor.id }))
      )
    }

    return { success: true, data: investor as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateInvestor(id: string, input: unknown): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updateInvestorSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investors')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function archiveInvestor(id: string): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .update({ status: 'closed' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Admin-only: reopening is a significant state change (same logic as archiving)
export async function reopenInvestor(id: string): Promise<ActionResult<Investor>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .update({ status: 'active' as EntityStatus })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Investor }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addInvestorPhone(investorId: string, input: unknown): Promise<ActionResult<InvestorPhone>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = investorPhoneSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investor_phones')
      .insert({ ...validated, investor_id: investorId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as InvestorPhone }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeInvestorPhone(phoneId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('investor_phones').delete().eq('id', phoneId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addInvestorEmail(investorId: string, input: unknown): Promise<ActionResult<InvestorEmail>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = investorEmailSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('investor_emails')
      .insert({ ...validated, investor_id: investorId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as InvestorEmail }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeInvestorEmail(emailId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('investor_emails').delete().eq('id', emailId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getInvestorDirectory(): Promise<ActionResult<Pick<Investor, 'id' | 'name' | 'locations_of_interest' | 'company'>[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, locations_of_interest, company')
      .eq('status', 'active')
      .order('name')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Pick<Investor, 'id' | 'name' | 'locations_of_interest' | 'company'>[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
