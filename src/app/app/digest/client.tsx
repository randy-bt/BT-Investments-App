'use client'

import { useEffect, useState } from 'react'
import type { DigestBodyJson } from '@/lib/digest/schema'
import { StructuredBody } from '@/components/digest/StructuredBody'

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
  body_json: DigestBodyJson | null
  source_emails: SourceEmail[]
  email_count: number
  window_start: string | null
  window_end: string | null
  created_at: string
}

export function DigestList({ initial }: { initial: Digest[] }) {
  // initial is ordered newest first by the server query.
  const [index, setIndex] = useState(0)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)

  const total = initial.length
  const current = total > 0 ? initial[index] : null
  const hasNewer = index > 0
  const hasOlder = index < total - 1

  // Keyboard nav — left/right arrows cycle digests when no inputs are
  // focused. Esc clears any open sources panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === 'ArrowLeft' && hasNewer) setIndex((i) => i - 1)
      else if (e.key === 'ArrowRight' && hasOlder) setIndex((i) => i + 1)
      else if (e.key === 'Escape') setSourcesOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasNewer, hasOlder])

  // Close the sources panel whenever you flip to a different digest.
  useEffect(() => { setSourcesOpen(false) }, [index])

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
            : 'Built — refresh to see the latest.',
        )
        if (json.emailCount > 0) {
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

  if (!current) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          No digests yet. The cron runs daily at 5 PM PT — or trigger one now:
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
      {/* Top bar — date + arrows on the left, build button on the right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => hasOlder && setIndex((i) => i + 1)}
            disabled={!hasOlder}
            aria-label="Older digest"
            title="Older digest (→)"
            className="rounded-full border border-neutral-300 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>

          <div className="flex flex-col items-center min-w-[180px]">
            <span className="text-sm font-medium text-neutral-700">
              {formatBuiltAt(current.created_at, current.window_start, current.window_end)}
            </span>
            <span className="text-[0.6rem] uppercase tracking-wider text-neutral-400">
              {index === 0 ? 'Most recent' : `${index + 1} of ${total}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => hasNewer && setIndex((i) => i - 1)}
            disabled={!hasNewer}
            aria-label="Newer digest"
            title="Newer digest (←)"
            className="rounded-full border border-neutral-300 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

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

      <article className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between border-b border-dashed border-neutral-200 pb-3">
          <h2 className="text-sm font-medium tracking-wide text-neutral-500">
            {formatBuiltAt(current.created_at, current.window_start, current.window_end)}
          </h2>
          <span className="text-[0.65rem] uppercase tracking-wider text-neutral-400">
            {current.email_count} {current.email_count === 1 ? 'email' : 'emails'}
          </span>
        </div>

        <p className="mt-4 text-base font-semibold text-neutral-900 leading-snug">
          {current.headline}
        </p>

        <div className="mt-4">
          {current.body_json ? (
            <StructuredBody json={current.body_json} />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {current.body}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSourcesOpen((o) => !o)}
          className="mt-4 text-xs text-neutral-400 hover:text-neutral-600"
        >
          {sourcesOpen ? '− Hide sources' : `+ Show ${current.source_emails.length} sources`}
        </button>

        {sourcesOpen && (
          <ul className="mt-3 space-y-2 border-t border-dashed border-neutral-200 pt-3 text-xs text-neutral-500">
            {current.source_emails.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-neutral-700">{s.source}</span> ·{' '}
                <span className="text-neutral-500">{s.subject}</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <p className="text-center text-[0.65rem] text-neutral-400">
        ← Newer · Older → (or click the chevrons)
      </p>
    </div>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === 'left' ? (
        <polyline points="15 6 9 12 15 18" />
      ) : (
        <polyline points="9 6 15 12 9 18" />
      )}
    </svg>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatBuiltAt(
  createdAtIso: string,
  windowStartIso: string | null,
  windowEndIso: string | null,
): string {
  const built = new Date(createdAtIso)
  const builtStr = built.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  if (!windowStartIso || !windowEndIso) return `Built ${builtStr}`

  const start = new Date(windowStartIso)
  const end = new Date(windowEndIso)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  const windowDesc = days === 1 ? 'past 24h' : `past ${days} days`
  return `Built ${builtStr} · ${windowDesc}`
}
