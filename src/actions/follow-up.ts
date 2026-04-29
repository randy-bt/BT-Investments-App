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

export async function triggerFollowUp(
  leadId: string,
  offset: Offset
): Promise<ActionResult<{ next_follow_up_date: string; movedFromAcq: boolean; leadName: string; update: Update }>> {
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

    const { data: acqRow } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', 'acquisitions')
      .single()

    let movedFromAcq = false
    let transformedLine: string | null = null

    const cleanLeadName = stripEmojis(lead.name)

    if (acqRow && acqRow.content) {
      const acqContent = acqRow.content as string
      const nameLower = cleanLeadName.toLowerCase()
      const match = findBlockBounds(acqContent, (b) =>
        stripEmojis(plainText(b)).toLowerCase().includes(nameLower)
      )
      if (match) {
        transformedLine = transformLineToFollowUp(
          match.block,
          cleanLeadName,
          targetDate,
          friendly
        )
        const newAcqContent = acqContent.slice(0, match.start) + acqContent.slice(match.end)
        const { error: acqErr } = await supabase
          .from('dashboard_notes')
          .update({ content: newAcqContent })
          .eq('module', 'acquisitions')
        if (acqErr) return { success: false, error: `ACQ update failed: ${acqErr.message}` }
        movedFromAcq = true
      }
    }

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
        movedFromAcq,
        leadName: cleanLeadName,
        update: insertedUpdate as Update,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
