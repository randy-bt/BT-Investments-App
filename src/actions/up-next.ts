'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { logApiUsage } from '@/lib/api-usage'
import { createUpdate } from '@/actions/updates'
import { triggerFollowUp } from '@/actions/follow-up'
import { archiveLead } from '@/actions/leads'
import type { ActionResult, Update } from '@/lib/types'

const CHECKMARK = '✅'
const CLOSE_MARKER = '❌❌'
const DASHBOARD_MODULES = ['acquisitions', 'acquisitions_b', 'follow_ups'] as const
type DashboardModule = (typeof DASHBOARD_MODULES)[number]

const BRIEF_MODEL = 'claude-sonnet-4-6'
const BRIEF_MAX_TOKENS = 250

const BRIEF_SYSTEM_PROMPT = `You are an analyst writing a one-line situation brief on a real estate lead. The output is a tiny snapshot — just enough to recognize where the deal stands. Tone is clinical, fact-heavy, no marketing language, no filler.

Produce exactly 1–2 sentences in this pattern:
"[Name], [property type & area], [pricing if known]. [most recent meaningful event + direction]."

Examples:
"Robin Schoenfield, Tukwila SFR, asking $480K. Verbally mutual on May 2; awaiting PSA review."
"Guy Phu, Renton condo. Three unanswered calls this week after a soft 'maybe' on May 1; momentum cooling."

If prior briefs exist, phrase the new one with continuity (e.g., "up from a soft maybe last week to verbally mutual today"). Do NOT include any preamble, headers, quotes, or commentary — just the brief itself.`

function stripEmojis(s: string): string {
  return s
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Walk <p>/<li>/<h*> blocks. For each block that contains the checkmark,
// resolve which lead's name appears in it (by emoji-stripped substring
// match against the entity table). Returns the unique lead IDs in
// document order across the dashboard.
function findCheckmarkedLeads(
  html: string,
  entities: { id: string; name: string }[],
): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  // Sort longest-first so multi-word names beat single-word substrings.
  const sortedEntities = [...entities].sort(
    (a, b) => b.name.length - a.name.length,
  )
  const re = /<(p|li|h[1-6])[^>]*>[\s\S]*?<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const block = match[0]
    if (!block.includes(CHECKMARK)) continue
    const lineLower = stripEmojis(plainText(block)).toLowerCase()
    if (!lineLower) continue
    for (const entity of sortedEntities) {
      const nameLower = stripEmojis(entity.name).toLowerCase()
      if (nameLower.length >= 2 && lineLower.includes(nameLower)) {
        if (!seen.has(entity.id)) {
          seen.add(entity.id)
          found.push(entity.id)
        }
        break
      }
    }
  }
  return found
}

// Mutate a dashboard so the line containing this lead's name + checkmark
// has its checkmark either removed or replaced with the close marker.
function mutateBlocks(
  html: string,
  leadName: string,
  transform: (block: string) => string,
): { html: string; changed: boolean } {
  const re = /<(p|li|h[1-6])[^>]*>[\s\S]*?<\/\1>/gi
  const nameLower = stripEmojis(leadName).toLowerCase()
  let changed = false
  const replaced = html.replace(re, (block) => {
    if (!block.includes(CHECKMARK)) return block
    const lineLower = stripEmojis(plainText(block)).toLowerCase()
    if (nameLower.length >= 2 && lineLower.includes(nameLower)) {
      changed = true
      return transform(block)
    }
    return block
  })
  return { html: replaced, changed }
}

async function applyDashboardMutation(
  leadName: string,
  mode: 'clear' | 'close',
): Promise<void> {
  const supabase = await createServerClient()
  const transform = (block: string) =>
    mode === 'close'
      ? block.replace(new RegExp(CHECKMARK, 'g'), CLOSE_MARKER)
      : block.replace(new RegExp(CHECKMARK, 'g'), '').replace(/\s+(<\/(p|li|h[1-6])>)/gi, '$1')

  for (const module of DASHBOARD_MODULES) {
    const { data } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', module)
      .single()
    if (!data?.content) continue
    const { html, changed } = mutateBlocks(data.content as string, leadName, transform)
    if (changed) {
      await supabase
        .from('dashboard_notes')
        .update({ content: html })
        .eq('module', module)
    }
  }
}

export type UpNextProperty = {
  id: string
  address: string | null
  sqft: number | null
  lot_size: string | null
  apn: string | null
  county: string | null
  zillow_value: number | null
  redfin_value: number | null
  rentcast_value: number | null
}

export type UpNextItem = {
  leadId: string
  leadName: string
  addresses: string[]
  properties: UpNextProperty[]
  brief: string | null
  briefStale: boolean
  recentUpdates: Array<{ author_name: string; content: string; created_at: string }>
  // Hashtag-style structured fields shown on the card.
  asking_price: string | null
  range: string | null
  our_current_offer: number | null
  condition: string | null
  occupancy_status: string | null
  selling_timeline: string | null
  // Disposition milestones (booleans).
  verbally_mutual: boolean
  psa_signed: boolean
  assignment_signed: boolean
  in_escrow: boolean
  emd_deposited: boolean
  closed: boolean
}

export async function getUpNextQueue(): Promise<ActionResult<UpNextItem[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    if (user.role !== 'admin') {
      return { success: false, error: 'Up Next is admin-only.' }
    }

    const supabase = await createServerClient()

    const [{ data: dashboards }, { data: leads }] = await Promise.all([
      supabase
        .from('dashboard_notes')
        .select('module, content')
        .in('module', DASHBOARD_MODULES as unknown as string[]),
      // No status filter: a ✅ on a closed lead's line is still a
      // checkmark the user wants to see + clear in the queue.
      supabase.from('leads').select('id, name'),
    ])

    if (!dashboards || !leads) {
      return { success: true, data: [] }
    }

    // Union of checkmarked lead IDs across all dashboards, in dashboard
    // order (ACQ first, then AACQ, then Follow-ups).
    const queuedIds: string[] = []
    const seen = new Set<string>()
    const moduleOrder: Record<string, number> = {
      acquisitions: 0,
      acquisitions_b: 1,
      follow_ups: 2,
    }
    const ordered = [...dashboards].sort(
      (a, b) =>
        (moduleOrder[a.module] ?? 99) - (moduleOrder[b.module] ?? 99),
    )
    for (const board of ordered) {
      const ids = findCheckmarkedLeads(board.content as string, leads)
      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id)
          queuedIds.push(id)
        }
      }
    }

    if (queuedIds.length === 0) return { success: true, data: [] }

    // Fetch details for queued leads.
    const [{ data: leadDetails }, { data: properties }, { data: latestBriefs }, { data: lastUpdates }] =
      await Promise.all([
        supabase.from('leads').select('*').in('id', queuedIds),
        supabase
          .from('properties')
          .select(
            'id, lead_id, address, sqft, lot_size, apn, county, zillow_value, redfin_value, rentcast_value',
          )
          .in('lead_id', queuedIds)
          .order('created_at'),
        supabase
          .from('lead_ai_briefs')
          .select('lead_id, brief_text, based_on_update_id')
          .in('lead_id', queuedIds)
          .order('generated_at', { ascending: false }),
        supabase
          .from('updates')
          .select('id, entity_id, content, created_at, users!author_id(name)')
          .eq('entity_type', 'lead')
          .in('entity_id', queuedIds)
          .order('created_at', { ascending: false })
          .limit(queuedIds.length * 5),
      ])

    const propsByLead = new Map<string, UpNextProperty[]>()
    for (const p of properties ?? []) {
      const arr = propsByLead.get(p.lead_id) ?? []
      arr.push({
        id: p.id,
        address: p.address ?? null,
        sqft: p.sqft ?? null,
        lot_size: p.lot_size ?? null,
        apn: p.apn ?? null,
        county: p.county ?? null,
        zillow_value: p.zillow_value ?? null,
        redfin_value: p.redfin_value ?? null,
        rentcast_value: p.rentcast_value ?? null,
      })
      propsByLead.set(p.lead_id, arr)
    }

    // Latest brief per lead (first occurrence wins because rows are sorted desc).
    const latestBriefByLead = new Map<
      string,
      { brief_text: string; based_on_update_id: string | null }
    >()
    for (const b of latestBriefs ?? []) {
      if (!latestBriefByLead.has(b.lead_id)) {
        latestBriefByLead.set(b.lead_id, {
          brief_text: b.brief_text,
          based_on_update_id: b.based_on_update_id,
        })
      }
    }

    // Most recent update id per lead (used to detect brief staleness).
    const latestUpdateByLead = new Map<string, string>()
    const recentUpdatesByLead = new Map<
      string,
      Array<{ author_name: string; content: string; created_at: string }>
    >()
    for (const u of lastUpdates ?? []) {
      if (!latestUpdateByLead.has(u.entity_id)) {
        latestUpdateByLead.set(u.entity_id, u.id)
      }
      const arr = recentUpdatesByLead.get(u.entity_id) ?? []
      if (arr.length < 3) {
        arr.push({
          author_name:
            ((u.users as { name?: string } | null)?.name) ?? 'Unknown',
          content: u.content,
          created_at: u.created_at,
        })
      }
      recentUpdatesByLead.set(u.entity_id, arr)
    }

    const leadById = new Map((leadDetails ?? []).map((l) => [l.id, l]))

    const items: UpNextItem[] = queuedIds
      .map((id) => {
        const lead = leadById.get(id)
        if (!lead) return null
        const latestBrief = latestBriefByLead.get(id) ?? null
        const latestUpdateId = latestUpdateByLead.get(id) ?? null
        const briefStale =
          !latestBrief ||
          latestBrief.based_on_update_id !== latestUpdateId
        const recents = (recentUpdatesByLead.get(id) ?? []).slice().reverse()
        const props = propsByLead.get(id) ?? []
        return {
          leadId: id,
          leadName: lead.name,
          addresses: props
            .map((p) => p.address)
            .filter((a): a is string => !!a),
          properties: props,
          brief: latestBrief?.brief_text ?? null,
          briefStale,
          recentUpdates: recents,
          asking_price: lead.asking_price ?? null,
          range: lead.range ?? null,
          our_current_offer: lead.our_current_offer ?? null,
          condition: lead.condition ?? null,
          occupancy_status: lead.occupancy_status ?? null,
          selling_timeline: lead.selling_timeline ?? null,
          verbally_mutual: !!lead.verbally_mutual,
          psa_signed: !!lead.psa_signed,
          assignment_signed: !!lead.assignment_signed,
          in_escrow: !!lead.in_escrow,
          emd_deposited: !!lead.emd_deposited,
          closed: !!lead.closed,
        } as UpNextItem
      })
      .filter((x): x is UpNextItem => x !== null)

    return { success: true, data: items }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Lightweight count for the homepage pill — uses the same
// name-matching logic as getUpNextQueue but skips the expensive lead
// detail / brief / activity fetches. Returns the number of UNIQUE
// active leads with a ✅ across all three dashboards.
export async function getUpNextCount(): Promise<ActionResult<number>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    if (user.role !== 'admin') return { success: true, data: 0 }

    const supabase = await createServerClient()
    const [{ data: dashboards }, { data: leads }] = await Promise.all([
      supabase
        .from('dashboard_notes')
        .select('module, content')
        .in('module', DASHBOARD_MODULES as unknown as string[]),
      // No status filter — see getUpNextQueue.
      supabase.from('leads').select('id, name'),
    ])
    if (!dashboards || !leads) return { success: true, data: 0 }

    const seen = new Set<string>()
    for (const board of dashboards) {
      const ids = findCheckmarkedLeads(board.content as string, leads)
      for (const id of ids) seen.add(id)
    }
    return { success: true, data: seen.size }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Generate (or reuse) the 1-2 sentence brief for a lead.
export async function generateLeadBrief(
  leadId: string,
): Promise<ActionResult<{ briefText: string; generatedFresh: boolean }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    if (user.role !== 'admin') {
      return { success: false, error: 'Up Next is admin-only.' }
    }

    const supabase = await createServerClient()

    const [
      { data: lead },
      { data: phones },
      { data: emails },
      { data: properties },
      { data: updates },
      { data: priorBriefs },
    ] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).single(),
      supabase
        .from('lead_phones')
        .select('phone_number')
        .eq('lead_id', leadId)
        .order('created_at'),
      supabase
        .from('lead_emails')
        .select('email')
        .eq('lead_id', leadId)
        .order('created_at'),
      supabase
        .from('properties')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at'),
      supabase
        .from('updates')
        .select('id, content, created_at, users!author_id(name)')
        .eq('entity_type', 'lead')
        .eq('entity_id', leadId)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('lead_ai_briefs')
        .select('brief_text, generated_at, based_on_update_id')
        .eq('lead_id', leadId)
        .order('generated_at', { ascending: false })
        .limit(5),
    ])

    if (!lead) return { success: false, error: 'Lead not found.' }

    // Gracefully degrade in environments without an Anthropic key
    // (e.g. local dev without `vercel env pull`). The card just shows
    // "No brief available" instead of surfacing the SDK error.
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        success: true,
        data: {
          briefText: '(AI brief unavailable — ANTHROPIC_API_KEY not set)',
          generatedFresh: false,
        },
      }
    }

    // Cache check: if the latest brief was based on the same most-recent
    // update id we currently have, no regeneration needed.
    const latestUpdateId =
      updates && updates.length > 0 ? (updates[updates.length - 1].id as string) : null
    const latestBrief = (priorBriefs ?? [])[0]
    if (latestBrief && latestBrief.based_on_update_id === latestUpdateId) {
      return {
        success: true,
        data: { briefText: latestBrief.brief_text as string, generatedFresh: false },
      }
    }

    // Build prompt.
    const fmtField = (key: string, label?: string) => {
      const v = (lead as Record<string, unknown>)[key]
      if (v === null || v === undefined || v === '') return null
      return `${label ?? key}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
    }
    const fields = [
      `Name: ${lead.name ?? '(unnamed)'}`,
      fmtField('date_converted', 'First contact'),
      fmtField('mailing_address', 'Mailing address'),
      fmtField('asking_price', 'Asking price'),
      fmtField('our_current_offer', 'Our current offer'),
      fmtField('range', 'Range'),
      fmtField('condition', 'Condition'),
      fmtField('occupancy_status', 'Occupancy'),
      fmtField('selling_timeline', 'Selling timeline'),
      lead.verbally_mutual && 'Verbally mutual: yes',
      lead.psa_signed && 'PSA signed: yes',
      lead.assignment_signed && 'Assignment signed: yes',
      lead.in_escrow && 'In escrow: yes',
      lead.emd_deposited && 'EMD deposited: yes',
      lead.closed && 'Closed: yes',
    ].filter(Boolean)

    const propsBlock = (properties ?? [])
      .map((p, i) => {
        const lines = [
          `Property ${i + 1}:`,
          p.address && `  Address: ${p.address}`,
          p.beds && `  Beds: ${p.beds}`,
          p.baths && `  Baths: ${p.baths}`,
          p.sqft && `  Sqft: ${p.sqft}`,
          p.year_built && `  Year built: ${p.year_built}`,
          p.zestimate && `  Zestimate: ${p.zestimate}`,
        ].filter(Boolean)
        return lines.join('\n')
      })
      .join('\n\n') || '(no properties on file)'

    const contactBlock =
      [
        (phones ?? []).length
          ? `Phones: ${(phones ?? []).map((p) => p.phone_number).join(', ')}`
          : null,
        (emails ?? []).length
          ? `Emails: ${(emails ?? []).map((e) => e.email).join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n') || '(none on file)'

    const feedBlock =
      (updates ?? [])
        .map((u) => {
          const when = new Date(u.created_at as string).toLocaleString()
          const author =
            ((u.users as { name?: string } | null)?.name) ?? 'Unknown'
          const content = String(u.content ?? '')
          const truncated =
            content.length > 1500 ? content.slice(0, 1500) + ' [...truncated]' : content
          return `[${when}] ${author}:\n${truncated}`
        })
        .join('\n\n') || '(no activity recorded yet)'

    const priorBlock =
      (priorBriefs ?? []).length === 0
        ? '(no prior briefs)'
        : (priorBriefs ?? [])
            .slice()
            .reverse()
            .map(
              (b) =>
                `[${new Date(b.generated_at as string).toLocaleString()}] ${b.brief_text}`,
            )
            .join('\n')

    const userContent = `## STRUCTURED FIELDS\n\n${fields.join('\n')}\n\n## CONTACT\n\n${contactBlock}\n\n## PROPERTIES\n\n${propsBlock}\n\n## ACTIVITY FEED (chronological)\n\n${feedBlock}\n\n## PRIOR BRIEFS (chronological — use for continuity)\n\n${priorBlock}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: BRIEF_MODEL,
      max_tokens: BRIEF_MAX_TOKENS,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    await logApiUsage({
      provider: 'anthropic',
      model: BRIEF_MODEL,
      feature: 'lead_up_next_brief',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    const briefText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text.trim())
      .join('\n')
      .trim()

    if (!briefText) {
      return { success: false, error: 'Empty brief returned. Try again.' }
    }

    await supabase.from('lead_ai_briefs').insert({
      lead_id: leadId,
      brief_text: briefText,
      based_on_update_id: latestUpdateId,
      created_by: user.id,
    })

    return { success: true, data: { briefText, generatedFresh: true } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Action: post a free-text update on the lead's activity feed AND clear
// the lead's checkmark from any dashboard it's on.
export async function postUpNextNote(
  leadId: string,
  content: string,
): Promise<ActionResult<{ update: Update }>> {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Up Next is admin-only.' }
  }
  const trimmed = content.trim()
  if (!trimmed) return { success: false, error: 'Empty note.' }

  const result = await createUpdate({
    entity_type: 'lead',
    entity_id: leadId,
    content: trimmed,
  })
  if (!result.success) return { success: false, error: result.error }

  const supabase = await createServerClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('name')
    .eq('id', leadId)
    .single()
  if (lead?.name) {
    await applyDashboardMutation(lead.name, 'clear')
  }

  return { success: true, data: { update: result.data } }
}

export async function upNextTriggerFollowUp(
  leadId: string,
  offset: '1week' | '1month',
): Promise<ActionResult<{ leadName: string; movedFromAcq: boolean }>> {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Up Next is admin-only.' }
  }
  const r = await triggerFollowUp(leadId, offset)
  if (!r.success) return { success: false, error: r.error }
  // Strip the lead's checkmark wherever it is. triggerFollowUp already
  // removed the lead's row from ACQ entirely (and inserted a new row
  // into Follow-ups without a checkmark), so this is mostly a safety
  // pass for any stray checkmark on AACQ.
  await applyDashboardMutation(r.data.leadName, 'clear')
  return {
    success: true,
    data: { leadName: r.data.leadName, movedFromAcq: r.data.movedFromAcq },
  }
}

// "Send to Deep Work" — switches a lead's marker from ✅ to 🟢. If the
// lead's line lives on AACQ, the line is also moved to the bottom of
// the ACQ Dashboard. If the line already lives on ACQ, it stays in
// place and just swaps the emoji.
export async function sendToDeepWork(
  leadId: string,
): Promise<ActionResult<{ leadName: string; movedFromAacq: boolean }>> {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Up Next is admin-only.' }
  }
  const supabase = await createServerClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('name')
    .eq('id', leadId)
    .single()
  if (!lead?.name) return { success: false, error: 'Lead not found.' }
  const cleanName = stripEmojis(lead.name).toLowerCase()

  const [acqRow, aacqRow] = await Promise.all([
    supabase.from('dashboard_notes').select('content').eq('module', 'acquisitions').single(),
    supabase.from('dashboard_notes').select('content').eq('module', 'acquisitions_b').single(),
  ])
  let acqContent: string = (acqRow.data?.content as string) ?? ''
  let aacqContent: string = (aacqRow.data?.content as string) ?? ''

  // Block-finder reused from the follow-up transform pattern.
  const blockRe = /<(p|li|h[1-6])[^>]*>[\s\S]*?<\/\1>/gi
  function findBlock(html: string): { block: string; start: number; end: number } | null {
    let m: RegExpExecArray | null
    while ((m = blockRe.exec(html)) !== null) {
      const lineLower = stripEmojis(plainText(m[0])).toLowerCase()
      if (cleanName.length >= 2 && lineLower.includes(cleanName)) {
        return { block: m[0], start: m.index, end: m.index + m[0].length }
      }
    }
    blockRe.lastIndex = 0
    return null
  }
  function plainText(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  function swapToGreen(block: string): string {
    return block.replace(new RegExp(CHECKMARK, 'g'), '🟢')
  }

  const acqMatch = findBlock(acqContent)
  let movedFromAacq = false

  if (acqMatch) {
    // Lead is already on ACQ — swap emoji in place.
    const newBlock = swapToGreen(acqMatch.block)
    acqContent = acqContent.slice(0, acqMatch.start) + newBlock + acqContent.slice(acqMatch.end)
    // Also remove from AACQ if it lived there too (cleanup).
    const aacqMatch = findBlock(aacqContent)
    if (aacqMatch) {
      aacqContent = aacqContent.slice(0, aacqMatch.start) + aacqContent.slice(aacqMatch.end)
      movedFromAacq = true
    }
  } else {
    // Not on ACQ — pull the line from AACQ, swap, append to ACQ bottom.
    const aacqMatch = findBlock(aacqContent)
    if (!aacqMatch) {
      return { success: false, error: `"${lead.name}" not found on ACQ or AACQ.` }
    }
    const newBlock = swapToGreen(aacqMatch.block)
    aacqContent = aacqContent.slice(0, aacqMatch.start) + aacqContent.slice(aacqMatch.end)
    acqContent = acqContent + newBlock
    movedFromAacq = true
  }

  const acqRes = await supabase
    .from('dashboard_notes')
    .update({ content: acqContent })
    .eq('module', 'acquisitions')
  if (acqRes.error) return { success: false, error: acqRes.error.message }
  if (movedFromAacq) {
    const aacqRes = await supabase
      .from('dashboard_notes')
      .update({ content: aacqContent })
      .eq('module', 'acquisitions_b')
    if (aacqRes.error) return { success: false, error: aacqRes.error.message }
  }

  return { success: true, data: { leadName: stripEmojis(lead.name), movedFromAacq } }
}

export async function upNextCloseLead(
  leadId: string,
): Promise<ActionResult<null>> {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Up Next is admin-only.' }
  }
  const supabase = await createServerClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('name')
    .eq('id', leadId)
    .single()

  const r = await archiveLead(leadId)
  if (!r.success) return { success: false, error: r.error }
  if (lead?.name) {
    await applyDashboardMutation(lead.name, 'close')
  }
  return { success: true, data: null }
}
