import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?reason=no_code', origin))
  }

  const redirectResponse = NextResponse.redirect(new URL('/app', origin))
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('[AUTH CALLBACK] Exchange failed:', error?.message, error?.status)
    const reason = error?.message
      ? `exchange_failed&detail=${encodeURIComponent(error.message)}`
      : 'exchange_failed'
    return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, origin))
  }

  const email = data.user.email || ''

  // Domain restriction
  if (!email.endsWith('@btinvestments.co')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/auth/error?reason=domain_restricted', origin))
  }

  // Create or update user record
  const adminClient = createAdminClient()

  // Check if user exists
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    // Check if this is the first user (they become admin)
    const { count } = await adminClient
      .from('users')
      .select('*', { count: 'exact', head: true })

    const isFirstUser = (count ?? 0) === 0
    const isRandy = email === 'randy@btinvestments.co'

    const { error: insertError } = await adminClient.from('users').insert({
      id: data.user.id,
      email,
      name: data.user.user_metadata?.full_name || email.split('@')[0],
      role: (isFirstUser || isRandy) ? 'admin' : 'member',
    })

    if (insertError) {
      console.error('[AUTH CALLBACK] User insert failed:', insertError)
    }
  }

  return redirectResponse
}
