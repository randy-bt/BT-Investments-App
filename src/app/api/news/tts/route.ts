import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { logApiUsage } from '@/lib/api-usage'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { text } = await request.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'TTS not configured' }, { status: 503 })
  }

  // Use a default voice — "Rachel" is a clear, natural-sounding voice
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'yj30vwTGJxSHezdAGsv9'

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    console.error('ElevenLabs TTS error:', res.status, errorText)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 502 })
  }

  // Estimate character count for usage logging
  await logApiUsage({
    provider: 'elevenlabs',
    model: 'eleven_turbo_v2_5',
    feature: 'news_tts',
    input_tokens: text.length,
    output_tokens: 0,
  })

  const audioBuffer = await res.arrayBuffer()

  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
