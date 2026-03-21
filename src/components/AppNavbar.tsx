"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  { label: "Home", href: "/app" },
  { label: "Acquisitions", href: "/app/acquisitions" },
  { label: "Dispositions", href: "/app/dispositions" },
  { label: "Listing Page", href: "/app/marketing-page-creator" },
  { label: "Agreements", href: "/app/contract-creator" },
  { label: "News", href: "/app/housing-market-news" },
  { label: "SMS", href: "/app/sms-marketing" },
  { label: "Settings", href: "/app/settings" },
];

const HIDDEN_PATTERNS = [
  /^\/app\/acquisitions\/lead-record\//,
  /^\/app\/dispositions\/investor-record\//,
];

export function AppNavbar() {
  const pathname = usePathname();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  const hidden = HIDDEN_PATTERNS.some((p) => p.test(pathname));

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || hidden) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (hidden) return null;

  return (
    <>
      {/* Sentinel — placed in document flow at the bottom of page content */}
      <div ref={sentinelRef} className="w-full h-0" />

      {/* Navbar */}
      <div
        className={`flex justify-center z-50 transition-shadow ${
          isSticky
            ? "fixed bottom-0 left-0 right-0 pb-4 pt-2 bg-gradient-to-t from-neutral-100 via-neutral-100/90 to-transparent dark:from-[#1a1a1a] dark:via-[#1a1a1a]/90"
            : "pt-2 pb-6"
        }`}
      >
        <nav
          className={`flex items-center gap-1 rounded-full border border-neutral-300 bg-white/95 backdrop-blur-sm px-2 py-1.5 dark:bg-neutral-800/95 dark:border-neutral-600 ${
            isSticky ? "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" : ""
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
