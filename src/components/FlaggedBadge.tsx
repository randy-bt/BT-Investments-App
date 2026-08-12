"use client";

// Flagged-lead count for a dashboard title row (Randy 8/10), with a breakdown
// panel (Randy 8/12).
//
// "Flagged" is any emoji right of the lead's name — see lib/flagged-lines.
// Counted in matched lead records, the same unit as the (N) beside it.
//
// The panel exists because this count is deliberately WIDER than an ACQ2
// round: state markers (📧 📬 💬 ☑️) are flags here but never pull a lead into
// a round. So the badge can read 26 while a round shows 25, which is correct
// but looks like a discrepancy until you can see why. The panel shows the
// split without leaving the page.
//
// Opens on hover AND on tap: hover alone is invisible on a phone, and a native
// title tooltip never fires on touch at all, which is why this is a real
// element rather than a title attribute.

import { useEffect, useRef, useState } from "react";
import type { FlagBreakdown } from "@/lib/flagged-lines";

export function FlaggedBadge({ breakdown }: { breakdown: FlagBreakdown | null }) {
  const b = breakdown ?? { total: 0, byEmoji: [], roundWorthy: 0 };
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // A tap opens the panel; the next tap anywhere else closes it. Without this
  // a touch user has no way to dismiss it, since there is no mouseleave.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const gap = b.total - b.roundWorthy;

  return (
    <span ref={rootRef} className="relative ml-2 inline-flex shrink-0 items-center">
      <button
        type="button"
        // Hover for mouse, click for touch, focus for keyboard. onMouseLeave
        // is what makes it feel like a tooltip on desktop; on touch it simply
        // never fires and the outside-tap handler above takes over.
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // The badge sits next to a collapse toggle; never let a tap on it
          // expand or collapse the dashboard.
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-label={`${b.total} flagged lead${b.total === 1 ? "" : "s"}. Show breakdown.`}
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-amber-800 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-200"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 22V4" />
          <path d="M4 4h13l-2.5 4L17 12H4" />
        </svg>
        <span className="tabular-nums">{b.total}</span>
      </button>

      {open && (
        <span
          role="tooltip"
          // left-0 rather than centered so it can never run off the left edge
          // of the card; whitespace-nowrap keeps the emoji row on one line.
          className="absolute left-0 top-full z-20 mt-1.5 w-max max-w-[min(20rem,80vw)] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-neutral-700 shadow-lg"
        >
          {b.total === 0 ? (
            <span className="text-neutral-500">Nothing flagged on this dashboard.</span>
          ) : (
            <>
              <span className="block whitespace-nowrap">
                <span className="font-semibold text-neutral-900">{b.total} flagged</span>
                <span className="text-neutral-400"> · </span>
                {b.byEmoji.map(({ emoji, count }, i) => (
                  <span key={emoji} className="whitespace-nowrap">
                    {i > 0 && <span className="text-neutral-300"> </span>}
                    {emoji}
                    <span className="tabular-nums">{count}</span>
                  </span>
                ))}
              </span>
              <span className="mt-1 block border-t border-neutral-100 pt-1 text-neutral-500">
                {b.roundWorthy} of these pull into an ACQ2 round
                {gap > 0 && (
                  <span className="block text-neutral-400">
                    {gap} {gap === 1 ? "is a state marker" : "are state markers"} only
                  </span>
                )}
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
