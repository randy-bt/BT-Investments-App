'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { searchSchema } from '@/lib/validations/search'
import type { ActionResult, SearchResults } from '@/lib/types'

export async function globalSearch(input: unknown): Promise<ActionResult<SearchResults>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { query } = searchSchema.parse(input)
    const supabase = await createServerClient()

    // Prepare search terms for full-text search and ILIKE
    const tsQueryTerms = query.split(/\s+/).filter(Boolean).map(t => `${t}:*`).join(' & ')
    const ilikePattern = `%${query}%`

    // Search leads by name (full-text, uses GIN index) and campaign name (ILIKE)
    const leadsPromise = supabase
      .from('leads')
      .select('id, name, status, stage')
      .or(`name.fts.${tsQueryTerms},source_campaign_name.ilike.${ilikePattern}`)
      .limit(10)

    // Search investors by name (full-text) and locations (full-text)
    const investorsPromise = supabase
      .from('investors')
      .select('id, name, status')
      .or(`name.fts.${tsQueryTerms},locations_of_interest.fts.${tsQueryTerms}`)
      .limit(10)

    // Search properties by address (full-text), APN (ILIKE), owner name (ILIKE)
    const propertiesPromise = supabase
      .from('properties')
      .select('id, address, lead_id, leads!inner(name)')
      .or(`address.fts.${tsQueryTerms},apn.ilike.${ilikePattern},owner_name.ilike.${ilikePattern}`)
      .limit(10)

    // Search phones/emails for leads (ILIKE — structured data)
    const leadPhonesPromise = supabase
      .from('lead_phones')
      .select('lead_id, leads!inner(id, name, status, stage)')
      .ilike('phone_number', ilikePattern)
      .limit(10)

    const leadEmailsPromise = supabase
      .from('lead_emails')
      .select('lead_id, leads!inner(id, name, status, stage)')
      .ilike('email', ilikePattern)
      .limit(10)

    // Search phones/emails for investors (ILIKE — structured data)
    const investorPhonesPromise = supabase
      .from('investor_phones')
      .select('investor_id, investors!inner(id, name, status)')
      .ilike('phone_number', ilikePattern)
      .limit(10)

    const investorEmailsPromise = supabase
      .from('investor_emails')
      .select('investor_id, investors!inner(id, name, status)')
      .ilike('email', ilikePattern)
      .limit(10)

    const [leads, investors, properties, leadPhones, leadEmails, investorPhones, investorEmails] =
      await Promise.all([
        leadsPromise,
        investorsPromise,
        propertiesPromise,
        leadPhonesPromise,
        leadEmailsPromise,
        investorPhonesPromise,
        investorEmailsPromise,
      ])

    // Merge and deduplicate lead results
    const leadMap = new Map<string, { id: string; name: string; status: string; stage: string }>()
    for (const lead of leads.data ?? []) {
      leadMap.set(lead.id, lead)
    }
    for (const row of [...(leadPhones.data ?? []), ...(leadEmails.data ?? [])]) {
      const lead = row.leads as unknown as { id: string; name: string; status: string; stage: string }
      if (lead) leadMap.set(lead.id, lead)
    }

    // Merge and deduplicate investor results
    const investorMap = new Map<string, { id: string; name: string; status: string }>()
    for (const inv of investors.data ?? []) {
      investorMap.set(inv.id, inv)
    }
    for (const row of [...(investorPhones.data ?? []), ...(investorEmails.data ?? [])]) {
      const inv = row.investors as unknown as { id: string; name: string; status: string }
      if (inv) investorMap.set(inv.id, inv)
    }

    // Format property results
    const propertyResults = (properties.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      address: p.address as string,
      lead_id: p.lead_id as string,
      lead_name: ((p.leads as { name: string }) || { name: 'Unknown' }).name,
    }))

    return {
      success: true,
      data: {
        leads: Array.from(leadMap.values()).slice(0, 10),
        investors: Array.from(investorMap.values()).slice(0, 10),
        properties: propertyResults.slice(0, 10),
      } as SearchResults,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
