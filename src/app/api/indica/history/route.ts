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
    const { data, error } = await supabase
      .from('indica_messages')
      .select('id, role, content, author_id, created_at, users(name)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const messages = (data ?? []).map((m) => ({
      id: m.id as string,
      role: m.role as 'user' | 'assistant',
      authorName: ((m.users as { name?: string } | null)?.name) ?? null,
      isCurrentUser: m.author_id === user.id,
      content: m.content as string,
    }))

    return NextResponse.json({ messages })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
