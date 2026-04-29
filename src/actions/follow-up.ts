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
import type { ActionResult } from '@/lib/types'

type Offset = '1week' | '1month'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeOffsetDate(offset: Offset, today: string): string {
  return offset === '1week' ? addDaysISO(today, 7) : addMonthsISO(today, 1)
}

function splitBlocks(html: string): string[] {
  return html.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? []
}

function joinBlocks(blocks: string[]): string {
  return blocks.join('')
}

function plainText(blockHtml: string): string {
  return blockHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function triggerFollowUp(
  leadId: string,
  offset: Offset
): Promise<ActionResult<{ next_follow_up_date: string; movedFromAcq: boolean }>> {
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
      .update({ next_follow_up_date: targetDate })
      .eq('id', leadId)
    if (upErr) return { success: false, error: upErr.message }

    await supabase.from('updates').insert({
      entity_type: 'lead',
      entity_id: leadId,
      content: `Follow up scheduled for ${friendly}`,
      created_by: user.id,
    })

    const { data: acqRow } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', 'acquisitions')
      .single()

    let movedFromAcq = false
    let transformedLine: string | null = null

    if (acqRow && acqRow.content) {
      const blocks = splitBlocks(acqRow.content as string)
      const nameLower = lead.name.toLowerCase()
      const matchIdx = blocks.findIndex((b) =>
        plainText(b).toLowerCase().includes(nameLower)
      )
      if (matchIdx >= 0) {
        transformedLine = transformLineToFollowUp(
          blocks[matchIdx],
          lead.name,
          targetDate,
          friendly
        )
        const newAcqBlocks = [...blocks.slice(0, matchIdx), ...blocks.slice(matchIdx + 1)]
        await supabase
          .from('dashboard_notes')
          .update({ content: joinBlocks(newAcqBlocks) })
          .eq('module', 'acquisitions')
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
      const fuBlocks = splitBlocks(fuContent)

      let insertIdx = fuBlocks.length
      for (let i = 0; i < fuBlocks.length; i++) {
        const blockDate = parseFollowUpDate(fuBlocks[i], today)
        if (blockDate && blockDate > targetDate) {
          insertIdx = i
          break
        }
      }

      const newFuBlocks = [
        ...fuBlocks.slice(0, insertIdx),
        transformedLine,
        ...fuBlocks.slice(insertIdx),
      ]

      await supabase
        .from('dashboard_notes')
        .update({ content: joinBlocks(newFuBlocks) })
        .eq('module', 'follow_ups')
    }

    return {
      success: true,
      data: { next_follow_up_date: targetDate, movedFromAcq },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
