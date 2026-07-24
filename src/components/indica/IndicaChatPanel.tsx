'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IndicaMessage } from './IndicaMessage'

type Phase = 'loading' | 'needs-backfill-confirm' | 'backfilling' | 'ready' | 'error'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  authorName: string | null
  authorEmail?: string | null
  isCurrentUser: boolean
  content: string
}

export type IndicaChatPanelProps = {
  entityType: 'lead' | 'investor'
  entityId: string
  currentUserName: string
  onClose: () => void
}

const PLUM = '#5D3954'

export function IndicaChatPanel(props: IndicaChatPanelProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [missingCount, setMissingCount] = useState(0)
  const [backfillFailed, setBackfillFailed] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const loadChat = useCallback(async () => {
    try {
      const url = `/api/indica/history?entity_type=${props.entityType}&entity_id=${props.entityId}`
      const res = await fetch(url)
      const json = await res.json()
      if (res.ok && Array.isArray(json.messages)) {
        setMessages(json.messages)
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
    setPhase('ready')
  }, [props.entityType, props.entityId])

  const initialize = useCallback(async () => {
    try {
      setPhase('loading')
      const url = `/api/indica/status?entity_type=${props.entityType}&entity_id=${props.entityId}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to check status')
        setPhase('error')
        return
      }
      if (json.needsBackfill) {
        setMissingCount(json.missingCount)
        setPhase('needs-backfill-confirm')
        return
      }
      await loadChat()
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }, [props.entityType, props.entityId, loadChat])

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, phase])

  async function runBackfill() {
    try {
      setPhase('backfilling')
      const res = await fetch('/api/indica/backfill-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: props.entityType, entity_id: props.entityId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Backfill failed')
        setPhase('error')
        return
      }
      setBackfillFailed(json.failed ?? 0)
      await loadChat()
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      authorName: props.currentUserName,
      isCurrentUser: true,
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    try {
      const res = await fetch('/api/indica/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: props.entityType,
          entity_id: props.entityId,
          user_message: text,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Indica failed to reply')
        setSending(false)
        return
      }
      const reply: ChatMessage = {
        id: `local-${Date.now()}-r`,
        role: 'assistant',
        authorName: null,
        isCurrentUser: false,
        content: json.reply,
      }
      setMessages((prev) => [...prev, reply])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed bottom-20 right-4 z-[60] flex h-[600px] max-h-[80vh] w-[400px] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white border-b-2 border-black"
        style={{ background: PLUM }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z" />
            <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
          </svg>
          <span className="font-semibold">Indica</span>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close Indica"
          className="text-white/80 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {phase === 'loading' && (
          <p className="text-center text-xs text-neutral-500">Checking…</p>
        )}

        {phase === 'needs-backfill-confirm' && (
          <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm space-y-3">
            <p className="font-medium">
              Indica needs to transcribe {missingCount} prior recording{missingCount === 1 ? '' : 's'} before we can chat.
            </p>
            <p className="text-xs text-neutral-600">
              This takes ~30s per recording.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runBackfill}
                className="rounded px-3 py-1.5 text-sm text-white"
                style={{ background: PLUM }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase === 'backfilling' && (
          <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm space-y-2">
            <p>Transcribing {missingCount} recording{missingCount === 1 ? '' : 's'}…</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full animate-pulse" style={{ background: PLUM, width: '70%' }} />
            </div>
            <p className="text-xs text-amber-700">
              Do not close this tab until complete.
            </p>
          </div>
        )}

        {phase === 'ready' && messages.length === 0 && (
          <p className="text-center text-xs text-neutral-500">
            Ask Indica anything about this {props.entityType}.
          </p>
        )}

        {phase === 'ready' && backfillFailed > 0 && (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
            {backfillFailed} recording{backfillFailed === 1 ? '' : 's'} couldn&apos;t be transcribed and isn&apos;t available to Indica.
          </p>
        )}

        {messages.map((m) => (
          <IndicaMessage
            key={m.id}
            role={m.role}
            authorName={m.authorName}
            authorEmail={m.authorEmail}
            isCurrentUser={m.isCurrentUser}
            content={m.content}
          />
        ))}

        {sending && (
          <p className="text-xs italic text-neutral-500">Indica is responding…</p>
        )}

        {error && (
          <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            disabled={phase !== 'ready' || sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={phase === 'ready' ? 'Ask Indica…' : 'Indica is getting ready…'}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={phase !== 'ready' || sending || !draft.trim()}
            className="rounded-md px-3 py-2 text-sm text-white disabled:opacity-50"
            style={{ background: PLUM }}
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
