import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Public form submission endpoint — no auth
  if (pathname.startsWith('/api/forms/')) {
    return NextResponse.next()
  }

  // Determine if this is an app request
  const isAppRequest =
    hostname.startsWith('app.') || // Production: app.btinvestments.co
    pathname.startsWith('/app') || // Dev: localhost:3000/app
    pathname.startsWith('/api/')   // API routes need auth (except forms, handled above)

  // Public pages — no auth needed
  if (!isAppRequest && !pathname.startsWith('/login') && !pathname.startsWith('/auth')) {
    return NextResponse.next()
  }

  // Refresh Supabase session via middleware
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

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
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Login page — if already authenticated, redirect to app
  if (pathname === '/login') {
    if (user) {
      return NextResponse.redirect(new URL('/app', request.url))
    }
    return response
  }

  // App routes — require auth
  if (isAppRequest && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
