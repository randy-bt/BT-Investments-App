"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Where We Buy", href: "/where-we-buy" },
  { label: "FAQ", href: "/faq" },
];

/**
 * MarketingNav
 *
 * Persistent right-edge olive bulge — always visible, never fades on
 * scroll, never replaced by a top-nav. Click → slide-out green panel
 * with nav links + CTA. Same behavior across mobile, tablet, and
 * desktop.
 */
export function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll while menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  return (
    <>
      {/* Persistent right-edge bulge — always visible regardless of scroll */}
      <motion.button
        type="button"
        onClick={() => setMenuOpen(true)}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scaleX: 1.18 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        aria-label="Open menu"
        className="fixed right-0 -translate-y-1/2 z-40 w-[57px] h-[208px] sm:w-[71px] sm:h-[260px]"
        style={{
          top: "26%",
          color: "var(--mkt-cream)",
          background: "transparent",
          padding: 0,
          border: "none",
          // Anchor scale to the right edge so it stretches leftward
          // (further into the page) on hover instead of off-screen
          transformOrigin: "100% 50%",
        }}
      >
        {/* Bulge body: two cubic Beziers that meet at a single apex
            point. The right edge stays vertical for ~42% of the height
            at top and bottom (cp1/cp2 at y=100/140), then sweeps inward
            to a rounded apex at (0, 120) where both beziers share
            strong downward tangents (cp2/cp1 at y=60 and y=180). */}
        <svg
          viewBox="0 0 60 240"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <path
            d="M 60 0 C 60 100, 0 60, 0 120 C 0 180, 60 140, 60 240 Z"
            fill="var(--mkt-olive)"
          />
        </svg>
        {/* Arrow centered slightly right of the SVG center */}
        <div
          className="absolute"
          style={{
            left: "60%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <svg
            width="51"
            height="51"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>
      </motion.button>

      {/* Slide-out green menu panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="menu"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: "var(--mkt-olive)" }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
              style={{ color: "var(--mkt-cream)" }}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <nav className="flex flex-col items-center gap-8">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.06 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-mkt-display text-4xl sm:text-5xl tracking-tight"
                    style={{ color: "var(--mkt-cream)" }}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 + NAV_ITEMS.length * 0.06 }}
                className="mt-4"
              >
                <Link
                  href="/sell-property"
                  onClick={() => setMenuOpen(false)}
                  className="font-mkt-sans rounded-full px-6 py-3 text-base"
                  style={{
                    background: "var(--mkt-cream)",
                    color: "var(--mkt-olive)",
                  }}
                >
                  Get Your Offer
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
