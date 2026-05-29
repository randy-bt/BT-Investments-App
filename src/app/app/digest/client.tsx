'use client'

import { useState } from 'react'

type SourceEmail = {
  source: string
  subject: string
  from: string
  received_at: string
  excerpt: string
}

type Digest = {
  id: string
  digest_date: string
  headline: string
  body: string
  source_emails: SourceEmail[]
  email_count: number
}

export function DigestList({ initial }: { initial: Digest[] }) {
  const [openSourcesFor, setOpenSourcesFor] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)

  async function buildToday() {
    setBuilding(true)
    setBuildMessage(null)
    try {
      const res = await fetch('/api/digest/build', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setBuildMessage(
          json.emailCount === 0
            ? 'No new emails in the window.'
            : `Built — refresh to see the latest.`,
        )
        if (json.emailCount > 0) {
          // Easy way to pick up the new digest.
          setTimeout(() => window.location.reload(), 800)
        }
      } else {
        setBuildMessage(`Failed: ${json.error}`)
      }
    } catch (e) {
      setBuildMessage(`Error: ${(e as Error).message}`)
    } finally {
      setBuilding(false)
    }
  }

  if (initial.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          No digests yet. The cron runs daily at 7 AM PST — or trigger one now:
        </p>
        <button
          type="button"
          onClick={buildToday}
          disabled={building}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-50"
        >
          {building ? 'Building…' : 'Build now'}
        </button>
        {buildMessage && <p className="text-xs text-neutral-500">{buildMessage}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {initial.length} {initial.length === 1 ? 'digest' : 'digests'} · newest first
        </p>
        <button
          type="button"
          onClick={buildToday}
          disabled={building}
          className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          {building ? 'Building…' : 'Build now'}
        </button>
      </div>
      {buildMessage && (
        <p className="-mt-4 text-xs text-neutral-500">{buildMessage}</p>
      )}

      {initial.map((d) => (
        <article
          key={d.id}
          className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm"
        >
          <div className="flex items-baseline justify-between border-b border-dashed border-neutral-200 pb-3">
            <h2 className="text-sm font-medium tracking-wide text-neutral-500">
              {formatDate(d.digest_date)}
            </h2>
            <span className="text-[0.65rem] uppercase tracking-wider text-neutral-400">
              {d.email_count} {d.email_count === 1 ? 'email' : 'emails'}
            </span>
          </div>

          <p className="mt-4 text-base font-semibold text-neutral-900 leading-snug">
            {d.headline}
          </p>

          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
            {d.body}
          </div>

          <button
            type="button"
            onClick={() => setOpenSourcesFor(openSourcesFor === d.id ? null : d.id)}
            className="mt-4 text-xs text-neutral-400 hover:text-neutral-600"
          >
            {openSourcesFor === d.id ? '− Hide sources' : '+ Show sources'}
          </button>

          {openSourcesFor === d.id && (
            <ul className="mt-3 space-y-2 border-t border-dashed border-neutral-200 pt-3 text-xs text-neutral-500">
              {d.source_emails.map((s, i) => (
                <li key={i}>
                  <span className="font-medium text-neutral-700">{s.source}</span> ·{' '}
                  <span className="text-neutral-500">{s.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  )
}

function formatDate(iso: string): string {
  // iso is a "YYYY-MM-DD" string. Render as "Wed, May 28, 2026".
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
