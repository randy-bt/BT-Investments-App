import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { CALL_SUMMARY_PROMPT, FOLLOW_UP_SUMMARY_PROMPT } from '@/lib/prompts/call-summary'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe-2025-12-15'
const ANTHROPIC_SUMMARY_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 2500

// Prefix that marks a note as an AI summary
export const AI_SUMMARY_PREFIX = '— AI Summary —\n\n'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const body = await request.json()
    const { attachmentId, entityType, entityId, leadName, leadAddress } = body as {
      attachmentId: string
      entityType: 'lead' | 'investor'
      entityId: string
      leadName?: string
      leadAddress?: string
    }

    if (!attachmentId || !entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. Get the attachment record to find storage path
    const supabase = await createServerClient()
    const { data: attachment } = await supabase
      .from('attachments')
      .select('storage_path, file_name, file_type, update_id')
      .eq('id', attachmentId)
      .single()

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Verify it's an audio file
    if (!attachment.file_type?.startsWith('audio/')) {
      return NextResponse.json(
        { success: false, error: 'Attachment is not an audio file' },
        { status: 400 }
      )
    }

    // 2. Check if a summary already exists for this audio's update
    const marker = `[summary-of:${attachment.update_id}]`
    const { count: existingCount } = await supabase
      .from('updates')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .like('content', `%${marker}%`)

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: 'This audio has already been summarized' },
        { status: 409 }
      )
    }

    // 3. Download audio from Supabase storage
    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage
      .from('attachments')
      .download(attachment.storage_path)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { success: false, error: 'Could not download audio file' },
        { status: 500 }
      )
    }

    // 4. Transcribe with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const audioBuffer = Buffer.from(await fileData.arrayBuffer())
    const audioFile = new File([audioBuffer], attachment.file_name, {
      type: attachment.file_type || 'audio/webm',
    })

    const transcription = await openai.audio.transcriptions.create({
      model: OPENAI_TRANSCRIPTION_MODEL,
      file: audioFile,
    })

    const transcript = transcription.text?.trim()
    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcription returned empty result' },
        { status: 500 }
      )
    }

    // 5. Auto-detect prompt based on filename format
    // Onboarding files: "4.2 Ann Hughes 96 - 5315 SW Charlestown St - 2069356680 - SS1 XXL.mp3"
    // Follow-up files: "4.5 Ann Hughes.webm" or similar (no " - " separators)
    const isOnboarding = (attachment.file_name.match(/ - /g) || []).length >= 3
    const basePrompt = isOnboarding ? CALL_SUMMARY_PROMPT : FOLLOW_UP_SUMMARY_PROMPT

    let metadataContext = ''
    if (leadName || leadAddress) {
      metadataContext = '\n\n---\n\n## LEAD CONTEXT\n\n'
      if (leadName) metadataContext += `Name: ${leadName}\n`
      if (leadAddress) metadataContext += `Address: ${leadAddress}\n`
    }

    const fullPrompt = `${basePrompt}${metadataContext}

---

## TRANSCRIPT

${transcript}`

    // 6. Summarize with Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: ANTHROPIC_SUMMARY_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    const summary = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text.trim())
      .join('\n')
      .trim()

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Summary generation returned empty result' },
        { status: 500 }
      )
    }

    // 7. Create update note with AI summary prefix and source marker
    const noteContent = `${AI_SUMMARY_PREFIX}${summary}\n\n${marker}`

    const { data: updateData, error: updateError } = await supabase
      .from('updates')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        author_id: user.id,
        content: noteContent,
      })
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Touch the parent entity's updated_by
    const table = entityType === 'lead' ? 'leads' : 'investors'
    await supabase
      .from(table)
      .update({ updated_by: user.id })
      .eq('id', entityId)

    return NextResponse.json({
      success: true,
      data: updateData,
    })
  } catch (e) {
    const message = (e as Error).message
    console.error('[SUMMARIZE] Error:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
