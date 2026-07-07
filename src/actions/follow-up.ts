'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import {
  addDaysISO,
  addMonthsISO,
  formatFriendly,
  parseFollowUpDate,
} from '@/lib/follow-up/date'
import { transformLineToFollowUp, stripTrailingEmojis } from '@/lib/follow-up/transform'
import { todayPacificISO, nowPacific } from '@/lib/pacific-date'
import { stripEmojis } from '@/lib/strip-emojis'
import { OWNER_EMAIL } from '@/lib/team'
import type { ActionResult, Update } from '@/lib/types'

type Offset = '1week' | '1month' | '3month'

function todayISO(): string {
  return todayPacificISO()
}

function datePrefix(): string {
  const now = nowPacific()
  return `${now.getMonth() + 1}.${now.getDate()} `
}

function computeOffsetDate(offset: Offset, today: string): string {
  if (offset === '1week') return addDaysISO(today, 7)
  if (offset === '3month') return addMonthsISO(today, 3)
  return addMonthsISO(today, 1)
}

function plainText(blockHtml: string): string {
  return blockHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Find the first <p>...</p> block matching a predicate and return its position bounds.
function findBlockBounds(
  content: string,
  predicate: (blockHtml: string) => boolean
): { block: string; start: number; end: number } | null {
  const re = /<p[^>]*>[\s\S]*?<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (predicate(m[0])) {
      return { block: m[0], start: m.index, end: m.index + m[0].length }
    }
  }
  return null
}

// Walk all <p> blocks in content; return the start-position of the first block
// whose follow-up date is later than `targetDate`. If none, returns content.length.
function findChronologicalInsertPos(
  content: string,
  targetDate: string,
  today: string
): number {
  const re = /<p[^>]*>[\s\S]*?<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const blockDate = parseFollowUpDate(m[0], today)
    if (blockDate && blockDate > targetDate) {
      return m.index
    }
  }
  return content.length
}

type SourceModule = 'acquisitions' | 'acquisitions_b'

// "Send+" (Randy-only): move a lead's line from the ACQ dashboard
// ('acquisitions') to the very bottom of the AACQ dashboard
// ('acquisitions_b'), stripping any status emojis from the right end of
// the line. The note itself is posted separately by the composer.
export async function sendPlusMoveToAacq(
  leadId: string
): Promise<ActionResult<{ moved: boolean; leadName: string }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    if (user.email !== OWNER_EMAIL) {
      return { success: false, error: 'Send+ is only available on Randy’s account.' }
    }

    const supabase = await createServerClient()
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, name')
      .eq('id', leadId)
      .single()
    if (leadErr || !lead) {
      return { success: false, error: leadErr?.message ?? 'Lead not found' }
    }

    const cleanLeadName = stripEmojis(lead.name)
    const nameLower = cleanLeadName.toLowerCase()

    const { data: acqRow } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', 'acquisitions')
      .single()
    const acqContent = (acqRow?.content as string) ?? ''
    const match = findBlockBounds(acqContent, (b) =>
      stripEmojis(plainText(b)).toLowerCase().includes(nameLower),
    )
    if (!match) {
      return { success: true, data: { moved: false, leadName: cleanLeadName } }
    }

    const cleanedLine = stripTrailingEmojis(match.block)

    // Write the DESTINATION first, then remove from the source. If the
    // AACQ append fails, ACQ is untouched (safe retry). If the ACQ removal
    // fails after a successful append, the line is briefly in both places —
    // visible and manually fixable. The old order (remove first) could lose
    // the line entirely when the second write failed.
    const { data: aacqRow } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', 'acquisitions_b')
      .single()
    const aacqContent = (aacqRow?.content as string) ?? ''
    const { error: aacqErr } = await supabase
      .from('dashboard_notes')
      .update({ content: aacqContent + cleanedLine })
      .eq('module', 'acquisitions_b')
    if (aacqErr) return { success: false, error: `AACQ update failed: ${aacqErr.message}` }

    const newAcq = acqContent.slice(0, match.start) + acqContent.slice(match.end)
    const { error: acqErr } = await supabase
      .from('dashboard_notes')
      .update({ content: newAcq })
      .eq('module', 'acquisitions')
    if (acqErr) {
      return {
        success: false,
        error: `Moved to AACQ but could not remove from ACQ (${acqErr.message}) — the line now appears on both dashboards; remove it from ACQ manually.`,
      }
    }

    return { success: true, data: { moved: true, leadName: cleanLeadName } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function triggerFollowUp(
  leadId: string,
  offset: Offset
): Promise<ActionResult<{ next_follow_up_date: string; moved: boolean; movedFrom: SourceModule | null; leadName: string; update: Update }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, name')
      .eq('id', leadId)
      .single()
    if (leadErr || !lead) {
      return { success: false, error: leadErr?.message ?? 'Lead not found' }
    }

    const today = todayISO()
    const targetDate = computeOffsetDate(offset, today)
    const friendly = formatFriendly(targetDate)

    const { error: upErr } = await supabase
      .from('leads')
      .update({ next_follow_up_date: targetDate, updated_by: user.id })
      .eq('id', leadId)
    if (upErr) return { success: false, error: upErr.message }

    const { data: insertedUpdate, error: updateErr } = await supabase
      .from('updates')
      .insert({
        entity_type: 'lead',
        entity_id: leadId,
        author_id: user.id,
        content: `${datePrefix()}Follow up on ${friendly}`,
      })
      .select()
      .single()
    if (updateErr || !insertedUpdate) {
      return { success: false, error: updateErr?.message ?? 'Update insert failed' }
    }

    const cleanLeadName = stripEmojis(lead.name)
    const nameLower = cleanLeadName.toLowerCase()

    // Search ACQ first, then AACQ. Whichever has the lead's line is
    // where we pull from. This was previously ACQ-only, so leads sat
    // on AACQ with a checkmark would never get moved when their
    // follow-up button fired.
    //
    // Find the source line WITHOUT writing anything yet — the follow-ups
    // append happens first, and only then is the source line removed. If
    // the append fails the source is untouched; if the removal fails the
    // line briefly exists in both places (visible, manually fixable). The
    // old order (remove first) could lose the line entirely.
    let transformedLine: string | null = null
    let movedFrom: SourceModule | null = null
    let sourceRemoval: { module: SourceModule; content: string } | null = null
    for (const sourceModule of ['acquisitions', 'acquisitions_b'] as const) {
      const { data: row } = await supabase
        .from('dashboard_notes')
        .select('content')
        .eq('module', sourceModule)
        .single()
      if (!row?.content) continue
      const sourceContent = row.content as string
      const match = findBlockBounds(sourceContent, (b) =>
        stripEmojis(plainText(b)).toLowerCase().includes(nameLower),
      )
      if (!match) continue
      transformedLine = transformLineToFollowUp(
        match.block,
        cleanLeadName,
        targetDate,
        friendly,
      )
      sourceRemoval = {
        module: sourceModule,
        content: sourceContent.slice(0, match.start) + sourceContent.slice(match.end),
      }
      movedFrom = sourceModule
      break
    }

    if (transformedLine && sourceRemoval) {
      const { data: fuRow } = await supabase
        .from('dashboard_notes')
        .select('content')
        .eq('module', 'follow_ups')
        .single()

      const fuContent = (fuRow?.content as string) ?? ''
      const insertPos = findChronologicalInsertPos(fuContent, targetDate, today)
      const newFuContent =
        fuContent.slice(0, insertPos) + transformedLine + fuContent.slice(insertPos)

      const { error: fuErr } = await supabase
        .from('dashboard_notes')
        .update({ content: newFuContent })
        .eq('module', 'follow_ups')
      if (fuErr) return { success: false, error: `Follow-ups update failed: ${fuErr.message}` }

      const { error: srcErr } = await supabase
        .from('dashboard_notes')
        .update({ content: sourceRemoval.content })
        .eq('module', sourceRemoval.module)
      if (srcErr) {
        return {
          success: false,
          error: `Added to Follow Ups but could not remove from ${sourceRemoval.module} (${srcErr.message}) — the line now appears on both dashboards; remove it from the source manually.`,
        }
      }
    }
    const moved = movedFrom !== null

    return {
      success: true,
      data: {
        next_follow_up_date: targetDate,
        moved,
        movedFrom,
        leadName: cleanLeadName,
        update: insertedUpdate as Update,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
