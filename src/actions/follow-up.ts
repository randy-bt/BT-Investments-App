'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import {
  addDaysISO,
  addMonthsISO,
  formatFriendly,
  parseFollowUpDate,
} from '@/lib/follow-up/date'
import { transformLineToFollowUp } from '@/lib/follow-up/transform'
import type { ActionResult, Update } from '@/lib/types'

type Offset = '1week' | '1month'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function datePrefix(): string {
  const now = new Date()
  return `${now.getMonth() + 1}.${now.getDate()} `
}

function computeOffsetDate(offset: Offset, today: string): string {
  return offset === '1week' ? addDaysISO(today, 7) : addMonthsISO(today, 1)
}

function plainText(blockHtml: string): string {
  return blockHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Strip emoji + collapse whitespace — used so leads whose stored name has a
// stray emoji (e.g. "🔷 Maria Dennis") still match dashboard lines that lay
// the same emoji out differently ("🔷🟢 Maria Dennis ...").
function stripEmojis(s: string): string {
  return s
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
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
    let transformedLine: string | null = null
    let movedFrom: SourceModule | null = null
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
      const newSourceContent =
        sourceContent.slice(0, match.start) + sourceContent.slice(match.end)
      const { error: srcErr } = await supabase
        .from('dashboard_notes')
        .update({ content: newSourceContent })
        .eq('module', sourceModule)
      if (srcErr) {
        return {
          success: false,
          error: `${sourceModule} update failed: ${srcErr.message}`,
        }
      }
      movedFrom = sourceModule
      break
    }
    const moved = movedFrom !== null

    if (transformedLine) {
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
    }

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
