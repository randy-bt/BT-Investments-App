"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";

const PRIMARY_ITEMS = [
  { label: "Home", href: "/app" },
  { label: "Acquisitions", href: "/app/acquisitions" },
  { label: "Dispositions", href: "/app/dispositions" },
  { label: "JVs", href: "/app/jvs", adminOnly: true },
  { label: "Outreach", href: "/app/outreach" },
  { label: "Marketing", href: "/app/marketing-page-creator" },
  { label: "News", href: "/app/housing-market-news" },
  { label: "Settings", href: "/app/settings" },
];

const EXPANDED_ITEMS = [
  { label: "Agreements", href: "/app/agreements" },
  { label: "SMS", href: "/app/sms-marketing" },
];

const HIDDEN_PATTERNS = [
  /^\/app\/acquisitions\/lead-record\//,
  /^\/app\/dispositions\/investor-record\//,
  /^\/app\/up-next(?:\/|$)/,
];

function isItemActive(itemHref: string, pathname: string): boolean {
  return itemHref === "/app" ? pathname === "/app" : pathname.startsWith(itemHref);
}

export function AppNavbar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
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
  // Mobile menu (agent-requests #11, Randy 8/13). The desktop pill needs about
  // 600px to lay its eight items out, so on a phone in portrait it ran off the
  // edge and he had to rotate to landscape to reach anything.
  const [menuOpen, setMenuOpen] = useState(false);

  const hidden = HIDDEN_PATTERNS.some((p) => p.test(pathname));
  const onExpandedPage = EXPANDED_ITEMS.some((item) => pathname.startsWith(item.href));
  const showExpanded = expanded || onExpandedPage;
  const filteredPrimaryItems = PRIMARY_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const splitIdx = filteredPrimaryItems.findIndex(i => i.href === "/app/outreach") + 1;
  // The phone menu always lists EVERY page: the expand/collapse toggle exists
  // because the pill runs out of horizontal room, and a vertical list does not.
  const menuItems = [
    ...filteredPrimaryItems.slice(0, splitIdx),
    ...EXPANDED_ITEMS,
    ...filteredPrimaryItems.slice(splitIdx),
  ];
  const visibleItems = showExpanded
    ? [...filteredPrimaryItems.slice(0, splitIdx), ...EXPANDED_ITEMS, ...filteredPrimaryItems.slice(splitIdx)]
    : filteredPrimaryItems;

  // Lock the page behind the panel and let Escape out, the same way the
  // marketing menu does.
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Close on route change. Each link already closes the panel on tap, so this
  // exists for the case they cannot cover: navigating with the browser's back
  // gesture while the panel is open, which would otherwise leave it up with
  // body scroll still locked. The functional form no-ops when it is already
  // closed, so the common case does not re-render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen((open) => (open ? false : open));
  }, [pathname]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        data-app-navbar
        className={`hidden md:flex justify-center z-50 transition-shadow ${
          isSticky
            ? "fixed bottom-0 left-0 right-0 pb-14 sm:pb-4 pt-2 bg-gradient-to-t from-neutral-100 via-neutral-100/90 to-transparent dark:from-[#1a1a1a] dark:via-[#1a1a1a]/90"
            : "pt-2 pb-14 sm:pb-6"
        }`}
      >
        <nav
          ref={navRef}
          className={`relative flex items-center gap-0.5 sm:gap-1 rounded-full border border-neutral-300 bg-white/95 backdrop-blur-sm px-1.5 sm:px-2 py-2 sm:py-1.5 transition-all dark:bg-neutral-800/95 dark:border-neutral-600 ${
            isSticky ? "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" : ""
          }`}
        >
          {/* Single stable pill — animates only x and width along the row */}
          {pill.visible && (
            <motion.span
              aria-hidden
              className="absolute top-2 bottom-2 sm:top-1.5 sm:bottom-1.5 left-0 rounded-full bg-neutral-800 dark:bg-neutral-200"
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
                className={`relative z-10 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-1 text-xs whitespace-nowrap transition-colors ${
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
              className="relative z-10 flex items-center justify-center rounded-full px-1.5 py-1.5 sm:py-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 transition-colors"
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

      {/* ---- mobile: floating button + centered menu (agent-requests #11) ----
          Modelled on the marketing menu's interaction (persistent tappable
          element, full-screen panel, scroll locked) but deliberately NOT its
          look: no bulge, and the app's own neutrals rather than the marketing
          green, so this still reads as the app.

          Bottom-LEFT by Randy's call: the Indica button owns bottom-right on
          lead records, and AppBranding is hidden at this width, so the corner
          is free. */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="md:hidden fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 bg-white/95 text-neutral-700 shadow-lg backdrop-blur-sm active:scale-95 dark:border-neutral-600 dark:bg-neutral-800/95 dark:text-neutral-200"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[60] flex flex-col items-center justify-center bg-neutral-100/97 backdrop-blur-md dark:bg-[#1a1a1a]/97"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 active:scale-95 dark:text-neutral-500"
              style={{ top: "max(env(safe-area-inset-top), 1.25rem)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {/* Every page, centered — the whole point is that nothing is out
                of reach the way it was in the horizontal pill. */}
            <nav className="flex w-full flex-col items-center gap-1 overflow-y-auto px-6 py-16">
              {menuItems.map((item) => {
                const isActive = isItemActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`w-full max-w-xs rounded-2xl px-6 py-3.5 text-center text-[17px] transition-colors ${
                      isActive
                        ? "bg-neutral-800 font-semibold text-white dark:bg-neutral-200 dark:text-neutral-900"
                        : "font-medium text-neutral-600 active:bg-neutral-200/70 dark:text-neutral-300 dark:active:bg-neutral-700/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
