import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formSubmissionSchema } from '@/lib/validations/forms'
import { sendFormNotification } from '@/lib/email'
import { RateLimiter } from '@/lib/rate-limit'

// 5 requests per IP per minute
const rateLimiter = new RateLimiter(5, 60000)

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const validated = formSubmissionSchema.parse(body)

    // Use anon client — RLS allows anon INSERT on public_form_submissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: insertedRow, error: dbError } = await supabase
      .from('public_form_submissions')
      .insert({
        form_name: validated.form_name,
        data: validated.data,
        ip_address: ip,
      })
      .select('id')
      .single()

    if (dbError || !insertedRow) {
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Send email notification (don't fail the request if email fails)
    const emailResult = await sendFormNotification(validated.form_name, validated.data)

    // Update notified flag by ID
    if (emailResult.success) {
      await supabase
        .from('public_form_submissions')
        .update({ notified: true })
        .eq('id', insertedRow.id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
