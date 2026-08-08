// Branded stand-in for a photo that is not up yet.
//
// Shared by the deals index cards and the listing template's photo frames so
// an empty slot looks the same in both places. The version this replaced was
// flat 4%-black with a line of italic serif, which read as a broken card
// rather than a deliberate one; this is built from the marketing palette
// instead - a soft olive wash on cream, the house mark used across the
// listing template, and the eyebrow treatment from the section headers.
//
// Pure presentation, no client hooks, so a server component can render it and
// a client component can import it.

export function PhotoComingSoon({ label = 'Photos Coming Soon' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        // Two stops of the brand olive at low alpha: enough depth that the
        // tile reads as designed, not enough to compete with a real photo
        // sitting next to it.
        background:
          'radial-gradient(120% 90% at 50% 0%, rgba(88,87,50,0.10) 0%, rgba(88,87,50,0.03) 55%, rgba(88,87,50,0.06) 100%), var(--mkt-cream-dim)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'rgba(88,87,50,0.10)',
          color: 'var(--mkt-olive)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <circle cx="12" cy="14.5" r="2.6" />
        </svg>
      </span>
      <span
        style={{
          fontSize: 9.5,
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--mkt-olive)',
          textAlign: 'center',
          padding: '0 12px',
        }}
      >
        {label}
      </span>
    </div>
  )
}
