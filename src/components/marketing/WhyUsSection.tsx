"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Why Choose Us
 *
 * Cream background. Editorial serif headline with a CYCLING italic-olive
 * phrase that changes every ~1.8s — fades in and out via AnimatePresence.
 * Body paragraph + 2x2 stat grid below.
 *
 * Right side: a placeholder photo with a quote testimonial card
 * overlapping its bottom-right corner. On mobile, photo + overlay still
 * stack but the photo fills width and the card sits at its bottom corner.
 */

const CYCLING_PHRASES = [
  "Simple Agreements.",
  "Local Expertise.",
  "Complete Transparency.",
  "Honest Offers.",
  "Real People.",
  "A Smooth Sale.",
  "Flexible Terms.",
];

const STATS = [
  { value: "500+", label: "Homes purchased" },
  { value: "$120M", label: "Paid to sellers" },
  { value: "7 days", label: "Avg. close time" },
  { value: "4.9★", label: "Seller rating" },
];

export function WhyUsSection() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % CYCLING_PHRASES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="w-full"
      style={{ background: "var(--mkt-cream)" }}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-12 pb-6 sm:pt-16 sm:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 lg:gap-16 items-start">
          {/* LEFT: eyebrow + headline + body + stats */}
          <div className="md:col-span-7">
            <div
              className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
              style={{ color: "var(--mkt-olive)" }}
            >
              Why Choose Us?
            </div>

            <h2
              className="mt-6 font-mkt-display"
              style={{
                fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 700,
                color: "var(--mkt-text-on-light)",
              }}
            >
              We promise you{" "}
              <span className="block sm:inline" />
              <span className="relative inline-block align-baseline">
                <AnimatePresence mode="wait">
                  <motion.em
                    key={CYCLING_PHRASES[phraseIdx]}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="font-mkt-display italic"
                    style={{
                      color: "var(--mkt-olive)",
                      fontWeight: 700,
                      display: "inline-block",
                    }}
                  >
                    {CYCLING_PHRASES[phraseIdx]}
                  </motion.em>
                </AnimatePresence>
              </span>
            </h2>

            <p
              className="font-mkt-sans mt-7 max-w-xl"
              style={{
                color: "var(--mkt-muted-light)",
                fontSize: "1.05rem",
                lineHeight: 1.55,
              }}
            >
              We&apos;re a small, family-run team. That means every offer is
              written by a real person, every contract is plain-English, and
              every promise is one we keep.
            </p>

            {/* Stat grid: 2x2 */}
            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 max-w-md">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div
                    className="font-mkt-display"
                    style={{
                      fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
                      lineHeight: 1,
                      fontWeight: 700,
                      color: "var(--mkt-text-on-light)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="font-mkt-sans mt-2 text-sm"
                    style={{ color: "var(--mkt-muted-light)" }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: photo with quote-card overlapping a corner */}
          <div className="md:col-span-5 w-full">
            <div className="relative aspect-[4/3] md:aspect-[3/4] rounded-2xl overflow-hidden">
              <PlaceholderLocalPhoto />
            </div>

            {/* Overlapping quote card — pulled up over the photo bottom-right */}
            <div
              className="relative -mt-20 ml-6 mr-2 sm:ml-12 sm:mr-4 rounded-xl p-4 sm:p-6 z-10"
              style={{
                background: "var(--mkt-cream-dim)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.10)",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="var(--mkt-olive-light)"
                aria-hidden
              >
                <path d="M7 7c-2 0-4 1.5-4 4v4h4v-4h-2c0-1.5 1-2.5 2-2.5V7zm10 0c-2 0-4 1.5-4 4v4h4v-4h-2c0-1.5 1-2.5 2-2.5V7z" />
              </svg>
              <p
                className="font-mkt-display mt-2"
                style={{
                  fontSize: "clamp(0.9rem, 1.4vw, 1.05rem)",
                  lineHeight: 1.45,
                  fontWeight: 500,
                  color: "var(--mkt-text-on-light)",
                }}
              >
                &ldquo;Called BT on Monday, had a cash offer Tuesday, closed
                the next week. They handled everything — I just signed.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-mkt-sans"
                  style={{
                    background: "rgba(124,139,79,0.2)",
                    color: "var(--mkt-olive)",
                    fontWeight: 600,
                  }}
                >
                  M
                </div>
                <div className="font-mkt-sans">
                  <div
                    className="text-sm"
                    style={{ color: "var(--mkt-text-on-light)", fontWeight: 600 }}
                  >
                    Maria H.
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--mkt-muted-light)" }}
                  >
                    Sold in Tacoma, WA · 2025
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlaceholderLocalPhoto() {
  // Stand-in: warm Pacific-Northwest-vibe gradient with simple landscape
  // shapes. Swap with real Tacoma / Puget Sound imagery when picked.
  return (
    <div
      className="w-full h-full relative"
      style={{
        background:
          "linear-gradient(180deg, #c9d4d6 0%, #a8b8b3 20%, #6b7b6e 45%, #3d4a3c 80%, #2a2c20 100%)",
      }}
    >
      <svg
        viewBox="0 0 600 800"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {/* Distant mountains */}
        <polygon points="0,200 80,140 180,180 280,120 360,160 460,130 600,200 600,260 0,260" fill="#5a6063" opacity="0.7" />
        {/* Water */}
        <rect x="0" y="240" width="600" height="120" fill="#7d8a8c" opacity="0.5" />
        {/* Houses */}
        <rect x="60" y="380" width="100" height="140" fill="#6b5a3a" />
        <polygon points="50,380 110,330 170,380" fill="#3d3225" />
        <rect x="200" y="400" width="120" height="160" fill="#7a6840" />
        <polygon points="190,400 260,340 330,400" fill="#3d3225" />
        <rect x="360" y="370" width="110" height="180" fill="#6b5a3a" />
        <polygon points="350,370 415,320 480,370" fill="#3d3225" />
        {/* Foreground green */}
        <rect x="0" y="540" width="600" height="260" fill="#4a5a3c" />
        <ellipse cx="100" cy="600" rx="80" ry="40" fill="#3a4a2c" />
        <ellipse cx="500" cy="610" rx="100" ry="50" fill="#3a4a2c" />
      </svg>
    </div>
  );
}
