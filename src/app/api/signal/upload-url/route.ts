import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimiter } from '@/lib/rate-limit'
import { signalUploadRequestSchema, signalMimeAllowed } from '@/lib/validations/signal'

// Signal intake uploads go browser -> storage directly: Vercel caps route
// bodies at ~4.5MB, so 25MB voice notes/files can never pass through a
// function. This route only mints a signed upload URL for the private
// signal-attachments bucket; the browser PUTs the bytes itself and the
// submit route re-verifies every object server-side before accepting it.

// Generous burst limiter: one submission can legitimately mint 6 URLs
// (5 files + 1 voice note).
const rateLimiter = new RateLimiter(12, 60000)

function extensionFor(name: string, mime: string): string {
  const fromName = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase()
  if (fromName) return fromName
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  }
  return map[mime.split(';')[0]] ?? 'bin'
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = signalUploadRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 })
    }
    const { kind, mime, size, name } = parsed.data

    if (!signalMimeAllowed(kind, mime)) {
      return NextResponse.json(
        { error: 'That file type is not supported.' },
        { status: 400 }
      )
    }

    // Unguessable path; the date prefix keeps the bucket browsable.
    const day = new Date().toISOString().slice(0, 10)
    const path = `${day}/${randomUUID()}.${extensionFor(name, mime)}`

    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('signal-attachments')
      .createSignedUploadUrl(path)

    if (error || !data) {
      console.error('[signal/upload-url] failed:', error?.message)
      return NextResponse.json({ error: 'Could not prepare the upload.' }, { status: 500 })
    }

    // size is echoed back at submit time and re-checked against the real
    // object; it is advisory here (the true cap is enforced post-upload).
    return NextResponse.json({ path: data.path, token: data.token })
  } catch {
    return NextResponse.json({ error: 'Could not prepare the upload.' }, { status: 500 })
  }
}
