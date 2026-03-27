"use client";

import { useState } from "react";

export function DashboardExpander({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center justify-center rounded-full p-2 text-neutral-400 transition-colors hover:text-neutral-600"
        aria-label={open ? "Collapse dashboards" : "Expand dashboards"}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && <div className="max-w-6xl mx-auto">{children}</div>}
    </div>
  );
}
