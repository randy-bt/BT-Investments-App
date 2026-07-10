import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const isAppHost = hostname.startsWith('app.')

  // Always-public endpoints — no auth, no host-based rewriting
  if (
    pathname.startsWith('/api/forms/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/deals/') ||
    pathname.startsWith('/api/news/refresh') ||
    // Cron endpoint with its own Bearer-secret auth (cron-health). Without
    // this exemption the middleware 307'd Vercel's cron to /login and the
    // scan silently never ran.
    pathname.startsWith('/api/jv/scan') ||
    // Signal intake is public lead capture (rate-limited in the routes).
    pathname.startsWith('/api/signal/')
  ) {
    return NextResponse.next()
  }

  // On app.* subdomain, the URL bar should never show the /app prefix.
  // Internal <Link href="/app/..."> clicks land here and get redirected
  // down to the clean URL; the rewrite below then re-adds /app for routing.
  if (isAppHost && pathname.startsWith('/app')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname === '/app' ? '/' : pathname.slice(4)
    return NextResponse.redirect(url, 308)
  }

  const isAppRequest = isAppHost
    ? pathname !== '/login' && !pathname.startsWith('/auth/')
    : pathname.startsWith('/app') ||
      pathname.startsWith('/api/') ||
      pathname === '/login' ||
      pathname.startsWith('/auth/')

  // Public marketing pages on the apex/www host
  if (!isAppRequest) {
    return NextResponse.next()
  }

  // Build the response. On app.* host we rewrite clean URLs (e.g. /dashboard)
  // to the actual file-system route (/app/dashboard) so Next.js can resolve
  // it. Auth pass-throughs (/login, /auth/*, /api/*) are NOT rewritten.
  const shouldRewrite =
    isAppHost &&
    pathname !== '/login' &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/api/')

  let response: NextResponse
  if (shouldRewrite) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = pathname === '/' ? '/app' : `/app${pathname}`
    response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: request.headers },
    })
  } else {
    response = NextResponse.next({
      request: { headers: request.headers },
    })
  }

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

  // Login page — let it through, no redirect to prevent loops
  if (pathname === '/login') {
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
