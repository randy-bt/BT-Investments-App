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

      {/* "Ask Indica" label — appears on hover, sits to the left of the button */}
      <div
        className={`fixed bottom-7 right-20 z-[60] pointer-events-none rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-lg transition-all duration-200 ${
          hover && !open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}
        style={{ background: PLUM }}
        aria-hidden
      >
        Ask Indica
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Open Indica"
        className="fixed bottom-4 right-4 z-[60] flex h-[70px] w-[70px] items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-125"
        style={{ background: hover ? PLUM_HOVER : PLUM }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9L12 3z" />
          <path d="M19 14l.7 1.8L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" />
        </svg>
      </button>
    </>
  )
}
