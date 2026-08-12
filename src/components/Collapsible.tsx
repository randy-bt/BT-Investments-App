"use client";

import { useState } from "react";

export function Collapsible({
  title,
  titleSuffix,
  titleBadge,
  children,
  defaultOpen = false,
  titleRight,
  compact = false,
}: {
  title: string;
  titleSuffix?: string;
  /** Rendered just right of the title, OUTSIDE the toggle button. The
   *  flagged-lead badge is itself a button (it opens a breakdown panel), and a
   *  button inside a button is invalid HTML — nesting it also meant a tap on
   *  the badge would collapse the dashboard. */
  titleBadge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  titleRight?: React.ReactNode;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2"
        >
          <svg
            width={compact ? "10" : "14"}
            height={compact ? "10" : "14"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-neutral-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <h2 className={compact ? "text-sm font-medium text-neutral-700" : "text-lg font-semibold tracking-tight"}>{title}{titleSuffix || ""}</h2>
        </button>
        {titleBadge}
        </div>
        {titleRight}
      </div>
      {open && <div className={compact ? "mt-2" : "mt-4"}>{children}</div>}
    </div>
  );
}
