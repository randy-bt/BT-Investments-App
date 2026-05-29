"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// Randy-only floating shortcut to /app/digest. Lives in the bottom-
// left corner across the entire /app shell. Muted cyan so it reads
// as "always available" rather than urgent. Hidden when already on
// the digest page so it doesn't sit on top of itself.
const RANDY_EMAIL = "randy@btinvestments.co";

export function DigestFloatingButton() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (user.email !== RANDY_EMAIL) return null;
  if (pathname.startsWith("/app/digest")) return null;

  return (
    <Link
      href="/app/digest"
      aria-label="Open Daily Digest"
      title="Daily Digest"
      className="fixed bottom-5 left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-all hover:scale-105 hover:shadow-lg"
      style={{
        background: "#0e7490", // cyan-700 — muted teal, noticeable without screaming
        color: "#ecfeff", // cyan-50 — soft icon color so it doesn't blow out
      }}
    >
      {/* Newspaper / digest icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 4h13a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4z" />
        <line x1="8" y1="8" x2="15" y2="8" />
        <line x1="8" y1="12" x2="15" y2="12" />
        <line x1="8" y1="16" x2="12" y2="16" />
      </svg>
    </Link>
  );
}
