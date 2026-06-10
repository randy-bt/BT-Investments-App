'use client'

import { useState } from 'react'
import { IndicaChatPanel } from './IndicaChatPanel'

const PLUM = '#5D3954'
const PLUM_HOVER = '#4A2D43'

export type FloatingIndicaButtonProps = {
  entityType: 'lead' | 'investor'
  entityId: string
  currentUserName: string
}

export function FloatingIndicaButton(props: FloatingIndicaButtonProps) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)

  return (
    <>
      {open && (
        <IndicaChatPanel
          entityType={props.entityType}
          entityId={props.entityId}
          currentUserName={props.currentUserName}
          onClose={() => setOpen(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Open Indica"
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: hover ? PLUM_HOVER : PLUM }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {/* Simple sparkle — the universal "AI" cue */}
          <path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z" />
          <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
        </svg>
      </button>
    </>
  )
}
