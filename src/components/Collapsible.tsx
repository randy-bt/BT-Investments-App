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
  /** Rendered just right of the title, inside the toggle button. Node rather
   *  than string because titleSuffix is plain text and the flagged-lead badge
   *  needs its own styling. */
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
          {titleBadge}
        </button>
        {titleRight}
      </div>
      {open && <div className={compact ? "mt-2" : "mt-4"}>{children}</div>}
    </div>
  );
}
