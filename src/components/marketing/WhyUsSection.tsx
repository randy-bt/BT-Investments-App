"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";

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
  "Plain English.",
  "Local Expertise.",
  "Transparency.",
  "Honest Offers.",
  "Real People.",
  "Smooth Sales.",
  "Flexible Terms.",
];

const STATS = [
  { value: "500+", label: "Homes purchased by our investors" },
  { value: "$0", label: "Hidden fees or commissions" },
  { value: "Locally", label: "Owned and operated" },
  { value: "24h", label: "Typical offer turnaround" },
];

// Standard whileInView config — fire once when 25% of the section is in view.
const VIEWPORT = { once: true, amount: 0.25 };

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
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
              style={{ color: "var(--mkt-olive)" }}
            >
              Why Choose Us?
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="mt-6 font-mkt-display"
              style={{
                fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
                lineHeight: 1.05,
                fontWeight: 700,
                color: "var(--mkt-text-on-light)",
              }}
            >
              Expect{" "}
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
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
              className="font-mkt-sans mt-7 max-w-xl"
              style={{
                color: "var(--mkt-muted-light)",
                fontSize: "1.05rem",
                lineHeight: 1.55,
              }}
            >
              We&apos;re a small, local team. That means every offer is
              written by a real person, every contract is plain-English, and
              every promise is one we keep.
            </motion.p>

            {/* Stat grid: 2x2 — each stat cascades in with its own delay */}
            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 max-w-md">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{
                    duration: 0.55,
                    ease: "easeOut",
                    delay: 0.6 + i * 0.1,
                  }}
                  whileHover={{
                    scale: 1.08,
                    transition: { duration: 0.25, ease: "easeOut" },
                  }}
                  className="origin-left cursor-default"
                >
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
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT: photo with quote-card overlapping a corner */}
          <div className="md:col-span-5 w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              whileHover="hover"
              className="relative aspect-[4/3] md:aspect-[3/4] rounded-2xl overflow-hidden"
            >
              {/* Inner motion wrapper handles hover-scale on the image
                  while the rounded container itself stays put — so the
                  photo grows within its frame, not the frame itself. */}
              <motion.div
                variants={{ hover: { scale: 1.08 } }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src="/marketing/why-us-aframe.jpg"
                  alt="Modern A-frame living room with large windows overlooking the forest"
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover"
                />
              </motion.div>
            </motion.div>

            {/* Overlapping quote card — entrance on the outer wrapper,
                continuous wiggle on the inner. The wiggle keyframes have
                varied magnitudes so the movement feels organic — mostly
                slow drift, with one slightly sharper sway per cycle. */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.7 }}
              className="relative -mt-20 ml-6 mr-2 sm:ml-12 sm:mr-4 z-10"
            >
              <motion.div
                animate={{
                  rotate: [0, -0.5, 0.3, 0, 0.7, 0, -0.4, 0],
                  y: [0, -1.5, 0.5, 0, 2.5, 0, -1, 0],
                }}
                transition={{
                  duration: 11,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.12, 0.25, 0.4, 0.5, 0.65, 0.85, 1],
                }}
                className="rounded-xl p-4 sm:p-6"
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
                &ldquo;Reached out about my dad&apos;s old house and BT made
                it painless. A fair offer, no pressure, no games. They handled
                every detail and I just showed up to sign.&rdquo;
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
                    David K.
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--mkt-muted-light)" }}
                  >
                    Sold in Redmond, WA · 2025
                  </div>
                </div>
              </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

