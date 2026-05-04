"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readFromHello } from "@/lib/from-hello";

/**
 * Fixed-position X button that returns the user to /hello.
 *
 * Only renders if the from-hello flag is set in sessionStorage —
 * users who landed on the sub-site directly never see it (so they
 * aren't pushed into a portal they didn't know existed).
 *
 * `variant` controls the foreground color so the X stays visible
 * against the host page's background:
 *   - "dark"  — for pages with light backgrounds (default)
 *   - "light" — for pages with dark backgrounds
 */
export function HelloReturnX({
  variant = "dark",
}: {
  variant?: "dark" | "light";
} = {}) {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setShow(readFromHello());
  }, []);

  if (!show) return null;

  const colorClass =
    variant === "light"
      ? "text-white/70 hover:text-white hover:bg-white/10"
      : "text-black/45 hover:text-black/80 hover:bg-black/5";

  return (
    <button
      type="button"
      className={`fixed top-5 right-5 sm:top-6 sm:right-6 p-2 transition-colors rounded-full z-50 ${colorClass}`}
      onClick={() => router.push("/hello")}
      aria-label="Back to overview"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
