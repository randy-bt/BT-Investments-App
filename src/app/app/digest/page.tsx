import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { DigestList } from './client'

export const dynamic = 'force-dynamic'

// Personal newsletter digest. Randy-only — Aldo and any other team
// member gets redirected to /app. The page renders the most recent
// 30 daily digests; scrolling back further is a follow-up if needed.
export default async function DigestPage() {
  const user = await getAuthUser()
  if (!user || user.email !== 'randy@btinvestments.co') {
    redirect('/app')
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('daily_digests')
    .select('id, digest_date, headline, body, source_emails, email_count')
    .order('digest_date', { ascending: false })
    .limit(30)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Digest</h1>
        <p className="text-sm text-neutral-600">
          Synthesized from TLDR, TLDR AI, Rundown AI, Superhuman, and Robinhood Snacks.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-600">Error loading digests: {error.message}</p>
      ) : (
        <DigestList initial={(data ?? []) as never} />
      )}
    </main>
  )
}
