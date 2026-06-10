'use client'

export type IndicaMessageProps = {
  role: 'user' | 'assistant'
  authorName: string | null // null for assistant
  isCurrentUser: boolean // true when the message author === viewer
  content: string
}

const PLUM = '#5D3954'

export function IndicaMessage(props: IndicaMessageProps) {
  if (props.role === 'assistant') {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[0.6rem] uppercase tracking-wider text-neutral-500">Indica</span>
        <div
          className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed text-white whitespace-pre-wrap"
          style={{ background: PLUM }}
        >
          {props.content}
        </div>
      </div>
    )
  }

  const bubbleStyle = props.isCurrentUser
    ? { background: '#8a6c00', color: '#ffffff' } // Randy / current user: saturated dark gold (matches Quick Action button + posted-update tint)
    : { background: '#e5e5e5', color: '#222' } // other user (Aldo): gray

  return (
    <div className="flex flex-col items-end gap-1">
      {props.authorName && (
        <span className="text-[0.6rem] uppercase tracking-wider text-neutral-500">
          {props.authorName}
        </span>
      )}
      <div
        className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
        style={bubbleStyle}
      >
        {props.content}
      </div>
    </div>
  )
}
