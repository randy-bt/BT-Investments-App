"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CycleButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCycle() {
    setLoading(true);

    try {
      const res = await fetch("/api/news/cycle", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Silent fail — page just doesn't refresh
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCycle}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors disabled:opacity-50"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={loading ? "animate-spin" : ""}
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
      {loading ? "Refreshing..." : "Refresh"}
    </button>
  );
}
