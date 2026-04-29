"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const PRIMARY_ITEMS = [
  { label: "Home", href: "/app" },
  { label: "Acquisitions", href: "/app/acquisitions" },
  { label: "Dispositions", href: "/app/dispositions" },
  { label: "Outreach", href: "/app/outreach" },
  { label: "News", href: "/app/housing-market-news" },
  { label: "Settings", href: "/app/settings" },
];

const EXPANDED_ITEMS = [
  { label: "Listing Page", href: "/app/marketing-page-creator" },
  { label: "Agreements", href: "/app/agreements" },
  { label: "SMS", href: "/app/sms-marketing" },
];

const HIDDEN_PATTERNS = [
  /^\/app\/acquisitions\/lead-record\//,
  /^\/app\/dispositions\/investor-record\//,
];

function isItemActive(itemHref: string, pathname: string): boolean {
  return itemHref === "/app" ? pathname === "/app" : pathname.startsWith(itemHref);
}

export function AppNavbar() {
  const pathname = usePathname();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const [isSticky, setIsSticky] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pill, setPill] = useState<{ x: number; width: number; visible: boolean }>({
    x: 0,
    width: 0,
    visible: false,
  });

  const hidden = HIDDEN_PATTERNS.some((p) => p.test(pathname));
  const onExpandedPage = EXPANDED_ITEMS.some((item) => pathname.startsWith(item.href));
  const showExpanded = expanded || onExpandedPage;
  const visibleItems = showExpanded
    ? [...PRIMARY_ITEMS.slice(0, 4), ...EXPANDED_ITEMS, ...PRIMARY_ITEMS.slice(4)]
    : PRIMARY_ITEMS;

  // Sticky observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || hidden) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hidden]);

  // Measure the active link to position the pill. useLayoutEffect runs after
  // DOM mutations but before the browser paints, so the pill is already in the
  // right place on the very first render — no "fly in from origin" flicker.
  useLayoutEffect(() => {
    if (hidden) return;
    const activeItem = visibleItems.find((item) => isItemActive(item.href, pathname));
    const linkEl = activeItem ? linkRefs.current.get(activeItem.href) : null;
    if (!linkEl || !navRef.current) {
      setPill((p) => ({ ...p, visible: false }));
      return;
    }
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = linkEl.getBoundingClientRect();
    setPill({
      x: linkRect.left - navRect.left,
      width: linkRect.width,
      visible: true,
    });
  }, [pathname, visibleItems.map((i) => i.href).join("|"), hidden]);

  // Recompute on resize so the pill stays glued to the active link
  useEffect(() => {
    function recompute() {
      if (hidden) return;
      const activeItem = visibleItems.find((item) => isItemActive(item.href, pathname));
      const linkEl = activeItem ? linkRefs.current.get(activeItem.href) : null;
      if (!linkEl || !navRef.current) return;
      const navRect = navRef.current.getBoundingClientRect();
      const linkRect = linkEl.getBoundingClientRect();
      setPill({
        x: linkRect.left - navRect.left,
        width: linkRect.width,
        visible: true,
      });
    }
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [pathname, hidden, visibleItems]);

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
          ref={navRef}
          className={`relative flex items-center gap-1 rounded-full border border-neutral-300 bg-white/95 backdrop-blur-sm px-2 py-1.5 transition-all dark:bg-neutral-800/95 dark:border-neutral-600 ${
            isSticky ? "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" : ""
          }`}
        >
          {/* Single stable pill — animates only x and width along the row */}
          {pill.visible && (
            <motion.span
              aria-hidden
              className="absolute top-1.5 bottom-1.5 left-0 rounded-full bg-neutral-800 dark:bg-neutral-200"
              initial={false}
              animate={{ x: pill.x, width: pill.width }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
          )}

          {visibleItems.map((item) => {
            const isActive = isItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  if (el) linkRefs.current.set(item.href, el);
                  else linkRefs.current.delete(item.href);
                }}
                className={`relative z-10 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-white dark:text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Expand/collapse toggle */}
          {!onExpandedPage && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="relative z-10 flex items-center justify-center rounded-full px-1.5 py-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title={showExpanded ? "Show less" : "Show more"}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showExpanded ? "rotate-180" : ""}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
