"use client";

import { motion } from "framer-motion";

/**
 * How It Works
 *
 * Dark near-black background. Editorial serif headline with one phrase
 * italicized + olive ("sold"). Right column intro paragraph.
 *
 * Desktop: 4 numbered columns with thin vertical dividers between.
 * Mobile:  4 stacked rows (number left, title + short desc right) — all
 *          four visible on one phone screen, no scroll within the steps.
 *
 * Entrance animations: every element animates in as the section scrolls
 * into view, each with its own treatment for a cinematic reveal:
 *   - Eyebrow: simple fade-in
 *   - Headline: 3 lines stagger up from below
 *   - Italic "sold": small scale pop alongside its line
 *   - Right paragraph: slides in from the right
 *   - 4 steps: cascade — number scales in, title slides from left, desc fades
 */

const STEPS = [
  {
    n: "01",
    title: "Tell us about your home",
    desktop:
      "Share your address and a few details. It takes less than a minute. No obligation.",
    mobile: "Share your address. Less than a minute. No obligation.",
  },
  {
    n: "02",
    title: "Get your proposal",
    desktop:
      "We analyze your property and present our offer along with alternative paths if a different route fits you better.",
    mobile: "We analyze your home and present our offer plus alternatives.",
  },
  {
    n: "03",
    title: "Choose Your Route",
    desktop:
      "Direct offer, creative terms, or open-market listing. Pick the path and the timeline that fits your life.",
    mobile: "Direct, creative, or listed. Your timeline.",
  },
  {
    n: "04",
    title: "Close & get paid",
    desktop:
      "We handle paperwork, title, and escrow. You walk away with funds in the bank.",
    mobile: "We handle paperwork. You walk away paid.",
  },
];

// Standard viewport spec for whileInView — fire once, when ~25% of the
// element is in view. Keeps the animation from re-triggering on scroll
// back up.
const VIEWPORT = { once: true, amount: 0.25 };

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="w-full scroll-mt-24"
      style={{
        background: "var(--mkt-dark)",
        color: "var(--mkt-text-on-dark)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 py-20 sm:py-28">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
          style={{ color: "var(--mkt-olive)" }}
        >
          How It Works
        </motion.div>

        {/* Headline + intro paragraph */}
        <div className="mt-2 sm:mt-3 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 lg:items-end">
          <h2
            className="lg:col-span-7 font-mkt-display"
            style={{
              fontSize: "clamp(2.925rem, 5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
            }}
          >
            <motion.span
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="block"
            >
              From hello to
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="block"
            >
              <motion.em
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={VIEWPORT}
                transition={{
                  duration: 0.6,
                  ease: [0.34, 1.56, 0.64, 1],
                  delay: 0.55,
                }}
                className="font-mkt-display italic inline-block"
                style={{ color: "#8a9550", fontStyle: "italic" }}
              >
                sold
              </motion.em>{" "}
              in weeks,
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
              className="block"
            >
              not months.
            </motion.span>
          </h2>
          <motion.p
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.65 }}
            className="lg:col-span-5 font-mkt-sans text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-dark)",
              lineHeight: 1.55,
            }}
          >
            We&apos;ve simplified the messy parts of selling. Paperwork,
            repairs, negotiating, waiting. You get clarity, control, and a
            closing date you actually choose.
          </motion.p>
        </div>

        {/* Tablet + Desktop: 4 columns with thin vertical dividers. */}
        <div className="hidden md:grid mt-20 grid-cols-4 gap-0">
          {STEPS.map((s, i) => (
            <DesktopStep key={s.n} step={s} index={i} />
          ))}
        </div>

        {/* Mobile only: 4 stacked compact rows */}
        <div className="md:hidden mt-10 space-y-5">
          {STEPS.map((s, i) => (
            <MobileStep key={s.n} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Step row variants ───────────────── */

type Step = (typeof STEPS)[number];

function DesktopStep({ step: s, index: i }: { step: Step; index: number }) {
  // Cascade delay so steps animate in one-by-one
  const baseDelay = 0.85 + i * 0.18;
  return (
    <div
      className="px-3 lg:px-6"
      style={{
        borderLeft: i === 0 ? "none" : "1px solid rgba(245,239,226,0.12)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={VIEWPORT}
        transition={{
          duration: 0.55,
          ease: [0.34, 1.56, 0.64, 1],
          delay: baseDelay,
        }}
        className="font-mkt-display origin-left"
        style={{
          color: "#8a9550",
          fontSize: "clamp(2.25rem, 3.5vw, 3.5rem)",
          lineHeight: 1,
          fontWeight: 400,
        }}
      >
        {s.n}
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.5, ease: "easeOut", delay: baseDelay + 0.15 }}
        className="font-mkt-display mt-6 lg:mt-10 whitespace-nowrap"
        style={{
          fontSize: "clamp(0.85rem, 1.5vw, 1.5rem)",
          fontWeight: 500,
        }}
      >
        {s.title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, ease: "easeOut", delay: baseDelay + 0.3 }}
        className="font-mkt-sans mt-3 text-xs lg:text-sm"
        style={{
          color: "var(--mkt-muted-dark)",
          lineHeight: 1.6,
        }}
      >
        {s.desktop}
      </motion.p>
    </div>
  );
}

function MobileStep({ step: s, index: i }: { step: Step; index: number }) {
  const baseDelay = 0.4 + i * 0.12;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.55, ease: "easeOut", delay: baseDelay }}
      className="flex gap-4 items-start"
    >
      <div
        className="font-mkt-display shrink-0"
        style={{
          color: "#8a9550",
          fontSize: "2.5rem",
          lineHeight: 1,
          fontWeight: 400,
          width: "3.5rem",
        }}
      >
        {s.n}
      </div>
      <div className="flex-1 pt-1">
        <h3
          className="font-mkt-display"
          style={{ fontSize: "1.25rem", fontWeight: 500 }}
        >
          {s.title}
        </h3>
        <p
          className="font-mkt-sans mt-1 text-sm"
          style={{
            color: "var(--mkt-muted-dark)",
            lineHeight: 1.5,
          }}
        >
          {s.mobile}
        </p>
      </div>
    </motion.div>
  );
}
