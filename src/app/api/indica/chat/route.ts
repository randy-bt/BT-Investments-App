import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildIndicaSystemPrompt } from '@/lib/indica/system-prompt'
import { buildEntityContext, type EntityContextInput } from '@/lib/indica/context'
import { logApiUsage } from '@/lib/api-usage'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1500

export const maxDuration = 60

type EntityType = 'lead' | 'investor'

async function loadLeadFields(supabase: Awaited<ReturnType<typeof createServerClient>>, id: string) {
  const { data } = await supabase.from('leads').select('*').eq('id', id).single()
  return data as Record<string, unknown> | null
}

async function loadInvestorFields(supabase: Awaited<ReturnType<typeof createServerClient>>, id: string) {
  const { data } = await supabase.from('investors').select('*').eq('id', id).single()
  return data as Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const body = await request.json()
    const { entity_type, entity_id, user_message } = body as {
      entity_type: EntityType
      entity_id: string
      user_message: string
    }
    if (!entity_type || !entity_id || !user_message || !user_message.trim()) {
      return NextResponse.json({ error: 'Missing entity_type, entity_id, or user_message' }, { status: 400 })
    }
    if (entity_type !== 'lead' && entity_type !== 'investor') {
      return NextResponse.json({ error: 'entity_type must be lead or investor' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // 1. Entity name + fields
    const record = entity_type === 'lead'
      ? await loadLeadFields(supabase, entity_id)
      : await loadInvestorFields(supabase, entity_id)
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    const entityName = (record.name as string) ?? '(unnamed)'

    // 2. Activity feed
    const { data: activity } = await supabase
      .from('updates')
      .select('id, content, created_at, author_id, users!updates_author_id_fkey(name)')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .order('created_at', { ascending: true })

    // 3. Attachments linked to those updates
    const updateIds = (activity ?? []).map((u) => u.id as string)
    const { data: attachments } = updateIds.length > 0
      ? await supabase
          .from('attachments')
          .select('id, file_name, file_type, update_id')
          .in('update_id', updateIds)
      : { data: [] as Array<{ id: string; file_name: string; file_type: string | null; update_id: string }> }

    // 4. Transcripts for those attachments
    const attachmentIds = (attachments ?? []).map((a) => a.id as string)
    const { data: transcripts } = attachmentIds.length > 0
      ? await supabase
          .from('call_transcripts')
          .select('attachment_id, transcript_text')
          .in('attachment_id', attachmentIds)
      : { data: [] as Array<{ attachment_id: string; transcript_text: string }> }

    // 5. Indica chat history
    const { data: history } = await supabase
      .from('indica_messages')
      .select('role, content, author_id, created_at, users(name)')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .order('created_at', { ascending: true })

    // 6. Build context
    const fields: Record<string, string | number | null | undefined> = {}
    for (const [k, v] of Object.entries(record)) {
      if (k === 'id' || k === 'name' || k === 'created_at' || k === 'updated_at') continue
      fields[k] = v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : (v as string | number)
    }

    const ctxInput: EntityContextInput = {
      entityType: entity_type,
      entity: { id: entity_id, name: entityName, fields },
      activity: (activity ?? []).map((a) => ({
        id: a.id as string,
        author_name: ((a.users as { name?: string } | null)?.name) ?? 'Unknown',
        created_at: a.created_at as string,
        content: a.content as string,
      })),
      attachments: (attachments ?? []).map((a) => ({
        id: a.id as string,
        file_name: a.file_name as string,
        file_type: (a.file_type as string | null) ?? null,
      })),
      transcripts: (transcripts ?? []).map((t) => ({
        attachment_id: t.attachment_id as string,
        transcript_text: t.transcript_text as string,
      })),
      chatHistory: (history ?? []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        author_name: ((m.users as { name?: string } | null)?.name) ?? null,
        content: m.content as string,
        created_at: m.created_at as string,
      })),
    }
    const ctx = buildEntityContext(ctxInput)

    // 7. Anthropic call with prompt caching on the static context block
    const askerName = (user.name as string | undefined) ?? user.email ?? 'there'
    const systemPrompt = buildIndicaSystemPrompt({ askerName, entityType: entity_type })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: ctx.staticContext, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        ...ctx.chatMessages,
        { role: 'user', content: `[${askerName}] ${user_message.trim()}` },
      ],
    })

    const replyText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n')
      .trim()

    if (!replyText) {
      return NextResponse.json({ error: 'Indica returned empty response' }, { status: 500 })
    }

    await logApiUsage({
      provider: 'anthropic',
      model: MODEL,
      feature: 'indica_chat',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    // 8. Persist user msg + assistant reply. Both rows MUST provide
    // created_at explicitly — PostgREST array inserts require uniform
    // column shape, so if one row omits a NOT NULL column, the other
    // row's insert is rejected as null. Bumping the assistant row by
    // 1 ms keeps the chronological ordering correct in loadChat.
    const nowMs = Date.now()
    const userIso = new Date(nowMs).toISOString()
    const asstIso = new Date(nowMs + 1).toISOString()
    const { error: insErr } = await supabase.from('indica_messages').insert([
      {
        entity_type,
        entity_id,
        role: 'user',
        author_id: user.id,
        content: user_message.trim(),
        created_at: userIso,
      },
      {
        entity_type,
        entity_id,
        role: 'assistant',
        author_id: null,
        content: replyText,
        created_at: asstIso,
      },
    ])
    if (insErr) {
      console.error('Indica message persist failed:', insErr.message)
      // Non-fatal — we still return the reply.
    }

    return NextResponse.json({ reply: replyText })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
