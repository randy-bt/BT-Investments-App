import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import OpenAI from 'openai'
import { logApiUsage } from '@/lib/api-usage'

const OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe-2025-12-15'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const body = await request.json()
    const { entity_type, entity_id } = body as { entity_type: string; entity_id: string }
    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })
    }
    if (entity_type !== 'lead' && entity_type !== 'investor') {
      return NextResponse.json({ error: 'entity_type must be lead or investor' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: attachments, error: attErr } = await supabase
      .from('attachments')
      .select('id, file_name, file_type, storage_path, updates!inner(entity_type, entity_id)')
      .eq('updates.entity_type', entity_type)
      .eq('updates.entity_id', entity_id)
      .like('file_type', 'audio/%')
    if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 })

    const audio = attachments ?? []
    if (audio.length === 0) {
      return NextResponse.json({ transcribed: 0, failed: 0, skipped: 0 })
    }

    const { data: existing } = await supabase
      .from('call_transcripts')
      .select('attachment_id')
      .in('attachment_id', audio.map((a) => a.id as string))
    const haveTranscript = new Set((existing ?? []).map((r) => r.attachment_id as string))

    const missing = audio.filter((a) => !haveTranscript.has(a.id as string))
    if (missing.length === 0) {
      return NextResponse.json({ transcribed: 0, failed: 0, skipped: audio.length })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const admin = createAdminClient()

    let transcribed = 0
    let failed = 0

    for (const a of missing) {
      try {
        const { data: fileData, error: dlErr } = await admin.storage
          .from('attachments')
          .download(a.storage_path as string)
        if (dlErr || !fileData) {
          console.error(`Backfill download failed for ${a.id}:`, dlErr?.message)
          failed++
          continue
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        const file = new File([buffer], a.file_name as string, {
          type: (a.file_type as string) || 'audio/webm',
        })

        const result = await openai.audio.transcriptions.create({
          model: OPENAI_TRANSCRIPTION_MODEL,
          file,
        })
        const text = result.text?.trim()
        if (!text) {
          failed++
          continue
        }

        // Real usage from OpenAI (audio input + text output tokens);
        // fall back to a text-length estimate if absent.
        const bUsage = (result as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
        await logApiUsage({
          provider: 'openai',
          model: OPENAI_TRANSCRIPTION_MODEL,
          feature: 'transcription_backfill',
          input_tokens: bUsage?.input_tokens ?? Math.ceil(text.length / 4),
          output_tokens: bUsage?.output_tokens ?? Math.ceil(text.length / 4),
        })

        const { error: insErr } = await supabase.from('call_transcripts').insert({
          attachment_id: a.id,
          transcript_text: text,
        })
        if (insErr) {
          console.error(`Backfill insert failed for ${a.id}:`, insErr.message)
          failed++
          continue
        }

        transcribed++
      } catch (e) {
        console.error(`Backfill exception for ${a.id}:`, (e as Error).message)
        failed++
      }
    }

    return NextResponse.json({ transcribed, failed, skipped: audio.length - missing.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
