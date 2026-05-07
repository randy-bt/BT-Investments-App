'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { logApiUsage } from '@/lib/api-usage'
import type { ActionResult, Update } from '@/lib/types'

// Prefix that marks an update as an AI Review (mirrors AI_SUMMARY_PREFIX
// pattern in /api/summarize). Kept private to this module since only
// the server action writes it; the activity feed detects it by its
// literal "— AI Review —" prefix.
const AI_REVIEW_PREFIX = '— AI Review —\n\n'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1500

const SYSTEM_PROMPT = `You are an analyst reviewing a real estate acquisitions lead record for an internal team. Produce a clinical, factual report. No marketing language, no speculation beyond what the record supports, no filler.

Output ONLY the report body in this exact format (no preamble, no headers like "Report:", just the four sections):

**Status**
1–3 sentences. Where the deal currently stands. Reference the disposition milestone the lead has reached if relevant (verbally mutual, PSA signed, in escrow, etc.).

**Signals & Blockers**
- Concrete signal or blocker observed in the record.
- Keep to 2–4 most material items.
- Each bullet stands alone — no nesting.

**Next Action**
1–2 specific, actionable moves in direct imperative voice. Name who should do it when obvious (e.g. "Have Aldo follow up Wednesday with a 7-day close angle.").

**Summary**
3–5 sentence narrative summary of the entire lead. What property, how the lead came in, current state, momentum direction. A reader of this section alone should understand the whole deal.`

function formatLeadContext(args: {
  lead: Record<string, unknown>
  phones: { phone_number: string }[]
  emails: { email: string }[]
  properties: Record<string, unknown>[]
  updates: { author_name: string; content: string; created_at: string }[]
}): string {
  const { lead, phones, emails, properties, updates } = args

  const fmtField = (key: string) => {
    const v = lead[key]
    if (v === null || v === undefined || v === '') return null
    return `${key}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
  }

  const fields = [
    `Name: ${lead.name ?? '(unnamed)'}`,
    fmtField('date_converted') && `First contact: ${lead.date_converted}`,
    fmtField('mailing_address'),
    fmtField('asking_price'),
    fmtField('our_current_offer'),
    fmtField('range'),
    fmtField('condition'),
    fmtField('occupancy_status'),
    fmtField('selling_timeline'),
    // Disposition milestones
    lead.verbally_mutual && 'Verbally mutual: yes',
    lead.psa_signed && 'PSA signed: yes',
    lead.assignment_signed && 'Assignment signed: yes',
    lead.in_escrow && 'In escrow: yes',
    lead.emd_deposited && 'EMD deposited: yes',
    lead.closed && 'Closed: yes',
    fmtField('emd_date'),
    fmtField('closing_date'),
  ].filter(Boolean)

  const propsBlock = properties.length
    ? properties
        .map((p, i) => {
          const lines = [
            `Property ${i + 1}:`,
            p.address && `  Address: ${p.address}`,
            p.beds && `  Beds: ${p.beds}`,
            p.baths && `  Baths: ${p.baths}`,
            p.sqft && `  Sqft: ${p.sqft}`,
            p.lot_size && `  Lot: ${p.lot_size}`,
            p.year_built && `  Year built: ${p.year_built}`,
            p.zestimate && `  Zestimate: ${p.zestimate}`,
            p.notes && `  Notes: ${p.notes}`,
          ].filter(Boolean)
          return lines.join('\n')
        })
        .join('\n\n')
    : '(no properties on file)'

  const contactBlock = [
    phones.length ? `Phones: ${phones.map((p) => p.phone_number).join(', ')}` : null,
    emails.length ? `Emails: ${emails.map((e) => e.email).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  // Activity feed in chronological order. Truncate very long updates so a
  // single 5000-char note doesn't dominate the prompt.
  const feedBlock = updates
    .map((u) => {
      const when = new Date(u.created_at).toLocaleString()
      const author = u.author_name || 'Unknown'
      const content =
        u.content.length > 1500
          ? u.content.slice(0, 1500) + ' [...truncated]'
          : u.content
      return `[${when}] ${author}:\n${content}`
    })
    .join('\n\n')

  return `## STRUCTURED FIELDS\n\n${fields.join('\n')}\n\n## CONTACT\n\n${contactBlock || '(none on file)'}\n\n## PROPERTIES\n\n${propsBlock}\n\n## ACTIVITY FEED (chronological)\n\n${feedBlock || '(no activity recorded yet)'}`
}

export async function generateLeadAIReview(
  leadId: string,
): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    // Stricter than requireAdmin: AI Review is admin-only by design.
    // Partners (Aldo) get admin-level CRUD but not AI Review.
    if (user.role !== 'admin') {
      return { success: false, error: 'AI Review is admin-only.' }
    }

    const supabase = await createServerClient()

    const [leadRes, phonesRes, emailsRes, propsRes, updatesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).single(),
      supabase.from('lead_phones').select('phone_number').eq('lead_id', leadId).order('created_at'),
      supabase.from('lead_emails').select('email').eq('lead_id', leadId).order('created_at'),
      supabase.from('properties').select('*').eq('lead_id', leadId).order('created_at'),
      supabase
        .from('updates')
        .select('content, created_at, users!author_id(name)')
        .eq('entity_type', 'lead')
        .eq('entity_id', leadId)
        .order('created_at', { ascending: true })
        .limit(500),
    ])

    if (leadRes.error || !leadRes.data) {
      return { success: false, error: 'Lead not found.' }
    }

    const updates = (updatesRes.data ?? []).map((row: Record<string, unknown>) => ({
      content: String(row.content ?? ''),
      created_at: String(row.created_at ?? ''),
      author_name:
        ((row.users as { name?: string } | null)?.name) ?? 'Unknown',
    }))

    const context = formatLeadContext({
      lead: leadRes.data,
      phones: phonesRes.data ?? [],
      emails: emailsRes.data ?? [],
      properties: propsRes.data ?? [],
      updates,
    })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    })

    await logApiUsage({
      provider: 'anthropic',
      model: MODEL,
      feature: 'lead_ai_review',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    const reportBody = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text.trim())
      .join('\n')
      .trim()

    if (!reportBody) {
      return { success: false, error: 'Empty review returned. Try again.' }
    }

    const noteContent = `${AI_REVIEW_PREFIX}${reportBody}`

    const { data: inserted, error: insertError } = await supabase
      .from('updates')
      .insert({
        entity_type: 'lead',
        entity_id: leadId,
        author_id: user.id,
        content: noteContent,
      })
      .select()
      .single()

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message || 'Insert failed.' }
    }

    // Touch the parent so "last updated" reflects this run.
    await supabase.from('leads').update({ updated_by: user.id }).eq('id', leadId)

    return { success: true, data: inserted as Update }
  } catch (e) {
    const message = (e as Error).message
    console.error('[lead-ai-review] error:', message)
    return { success: false, error: message }
  }
}
