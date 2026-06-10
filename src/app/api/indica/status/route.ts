import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const url = new URL(request.url)
    const entityType = url.searchParams.get('entity_type')
    const entityId = url.searchParams.get('entity_id')
    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })
    }
    if (entityType !== 'lead' && entityType !== 'investor') {
      return NextResponse.json({ error: 'entity_type must be lead or investor' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Get all audio attachments linked to updates of this entity.
    const { data: attachments, error: attErr } = await supabase
      .from('attachments')
      .select('id, file_type, updates!inner(entity_type, entity_id)')
      .eq('updates.entity_type', entityType)
      .eq('updates.entity_id', entityId)
      .like('file_type', 'audio/%')
    if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 })

    const allAudioIds = (attachments ?? []).map((a) => a.id as string)

    if (allAudioIds.length === 0) {
      return NextResponse.json({ needsBackfill: false, missingCount: 0 })
    }

    const { data: existing, error: tErr } = await supabase
      .from('call_transcripts')
      .select('attachment_id')
      .in('attachment_id', allAudioIds)
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

    const haveTranscript = new Set((existing ?? []).map((r) => r.attachment_id as string))
    const missingCount = allAudioIds.filter((id) => !haveTranscript.has(id)).length

    return NextResponse.json({ needsBackfill: missingCount > 0, missingCount })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
