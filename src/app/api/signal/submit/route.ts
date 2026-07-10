import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimiter } from '@/lib/rate-limit'
import { sendSignalNotification } from '@/lib/email'
import {
  signalSubmissionSchema,
  SIGNAL_MAX_FILE_BYTES,
} from '@/lib/validations/signal'

// Signal intake submissions (handoff 001). Public, rate-limited. The
// attachments were already uploaded browser->storage via signed URLs
// (/api/signal/upload-url); this route verifies each claimed object
// actually exists in the bucket with a sane size before recording it.

const rateLimiter = new RateLimiter(5, 60000)
const PER_MINUTE_LIMIT = 5
const PER_DAY_LIMIT = 20

function sigLabel(n: number): string {
  return `SIG-${String(n).padStart(3, '0')}`
}

function fmtDuration(seconds?: number): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const parsed = signalSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid submission'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const v = parsed.data

    const admin = createAdminClient()

    // DB-backed rate limit — authoritative across serverless instances.
    const [minuteRes, dayRes] = await Promise.all([
      admin
        .from('signal_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('created_at', new Date(Date.now() - 60_000).toISOString()),
      admin
        .from('signal_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    ])
    if ((minuteRes.count ?? 0) >= PER_MINUTE_LIMIT || (dayRes.count ?? 0) >= PER_DAY_LIMIT) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Verify every claimed attachment really exists in the bucket and is
    // within the size cap (the client's stated size is not trusted).
    for (const att of v.attachments) {
      const slash = att.storage_path.lastIndexOf('/')
      const folder = slash > 0 ? att.storage_path.slice(0, slash) : ''
      const filename = att.storage_path.slice(slash + 1)
      const { data: objects, error } = await admin.storage
        .from('signal-attachments')
        .list(folder, { search: filename, limit: 10 })
      const found = objects?.find((o) => o.name === filename)
      if (error || !found) {
        return NextResponse.json(
          { error: 'One of your attachments did not finish uploading. Remove it and try again.' },
          { status: 400 }
        )
      }
      const realSize = (found.metadata as { size?: number } | null)?.size
      if (typeof realSize === 'number' && realSize > SIGNAL_MAX_FILE_BYTES) {
        await admin.storage.from('signal-attachments').remove([att.storage_path])
        return NextResponse.json(
          { error: 'One of your files is too large (25MB max).' },
          { status: 400 }
        )
      }
      if (typeof realSize === 'number') att.size = realSize
    }

    const { data: row, error: insertErr } = await admin
      .from('signal_submissions')
      .insert({
        message_text: v.message_text.trim() || null,
        name: v.name.trim() || null,
        business_name: v.business_name.trim() || null,
        email: v.email.trim(),
        phone: v.phone.trim() || null,
        ip_address: ip,
        attachments: v.attachments,
      })
      .select('id, sig_number')
      .single()

    if (insertErr || !row) {
      console.error('[signal/submit] insert failed:', insertErr?.message)
      return NextResponse.json(
        { error: 'Something went wrong saving your message. Please try again.' },
        { status: 500 }
      )
    }

    // Email Randy (best-effort: a failed email never fails the submission;
    // the row is already saved and visible in /app/signals).
    const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://btinvestments.co').replace(/\/$/, '')
    const summary = v.attachments.map((a) =>
      a.kind === 'voice'
        ? `Voice note${a.duration_seconds ? ` (${fmtDuration(a.duration_seconds)})` : ''}`
        : `${a.kind}: ${a.original_name}`
    )
    const emailResult = await sendSignalNotification({
      sigLabel: sigLabel(row.sig_number),
      name: v.name.trim(),
      businessName: v.business_name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      messageText: v.message_text,
      attachmentSummary: summary,
      link: `${base}/app/signals/${row.id}`,
    })
    if (!emailResult.success) {
      console.error('[signal/submit] notification email failed:', emailResult.error)
    }

    return NextResponse.json({ success: true, sig: sigLabel(row.sig_number) })
  } catch (e) {
    console.error('[signal/submit] error:', e)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
