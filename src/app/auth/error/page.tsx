'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const messages: Record<string, string> = {
    domain_restricted: 'Access is restricted to @btinvestments.co email addresses only.',
    exchange_failed: 'Authentication failed. Please try again.',
    no_code: 'Invalid authentication request.',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-lg border border-dashed border-neutral-300 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-neutral-900">
          Access Denied
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-600">
          {messages[reason || ''] || 'An unknown error occurred.'}
        </p>
        <Link
          href="/login"
          className="block w-full rounded-md border border-neutral-400 bg-neutral-50 px-4 py-3 text-center text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  )
}
