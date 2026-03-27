'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-lg border border-dashed border-neutral-300 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-neutral-900">
          BT Investments
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-500">
          Sign in to access the app
        </p>
        <button
          onClick={handleLogin}
          className="w-full rounded-md border border-neutral-400 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
