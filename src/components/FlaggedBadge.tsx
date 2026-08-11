// Flagged-lead count for a dashboard title row (Randy 8/10).
//
// "Flagged" is any emoji right of the lead's name — see lib/flagged-lines for
// the rule. Counted in matched lead records, the same unit as the (N) beside
// it, so "26 of 61" reads true.
//
// Always rendered when enabled, including at zero: Randy asked for a fixed
// position so a missing badge means something is broken rather than "nothing
// is flagged".
//
// Shared by CollapsibleDashboard and DashboardWithCount, which draw their
// title rows separately — one component so the two can't drift apart.

export function FlaggedBadge({ count }: { count: number | null }) {
  const n = count ?? 0
  return (
    <span
      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-800 ring-1 ring-inset ring-amber-200"
      title={`${n} flagged lead${n === 1 ? '' : 's'} on this dashboard`}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 22V4" />
        <path d="M4 4h13l-2.5 4L17 12H4" />
      </svg>
      <span className="tabular-nums">{n}</span>
    </span>
  )
}
