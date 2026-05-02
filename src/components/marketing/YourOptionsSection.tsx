"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Your Options
 *
 * Cream background. Italic-emphasis serif headline + sans intro paragraph.
 * Three option cards (mockup-2 design): icon-square top-left, title,
 * olive sub-headline, body, checklist with olive checkmarks, full-width
 * pill CTA at bottom.
 *
 * Cash Offer = featured card: dark background, "Most Popular" badge top-right,
 *              olive CTA. Aligned in height with the other two (NOT towering).
 * Creative Financing + On-Market Listing = light background, dark CTA.
 *
 * All three "Learn More" buttons → /sell-property (CTA1).
 *
 * Entrance animations fire as the section scrolls into view (whileInView,
 * once: true) so each load feels staged rather than dumped on screen.
 */

const VIEWPORT = { once: true, amount: 0.25 };

const OPTIONS = [
  {
    key: "cash" as const,
    icon: "$",
    title: "Direct Offer",
    sub: "Fast & flexible",
    desc:
      "Get a personalized offer with no obligation. We buy as-is, with zero repairs and no showings.",
    bullets: [
      "Sold as-is",
      "No repairs or cleaning",
      "Zero agent commissions",
      "We cover closing costs",
      "Guaranteed — no contingencies",
    ],
    badge: "Most Popular",
    featured: true,
  },
  {
    key: "creative" as const,
    icon: "💡",
    title: "Creative Financing",
    sub: "Maximum flexibility",
    desc:
      "Seller financing, lease options, or subject-to deals. Terms tailored to your situation.",
    bullets: [
      "Higher total price",
      "Monthly passive income",
      "Installment-sale tax benefits",
      "Flexible custom terms",
      "Professionally managed",
    ],
    featured: false,
  },
  {
    key: "list" as const,
    icon: "↗",
    title: "On-Market Listing",
    sub: "Top dollar potential",
    desc:
      "Our in-house brokers know the investor side too. Sharper pricing, smarter negotiation, more in your pocket.",
    bullets: [
      "Maximum market exposure",
      "Pro photography & staging",
      "Expert negotiation",
      "MLS & major platforms",
      "Dedicated broker support",
    ],
    featured: false,
  },
];

export function YourOptionsSection() {
  return (
    <section
      id="three-ways"
      className="w-full scroll-mt-0"
      style={{ background: "var(--mkt-cream)" }}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-20 pb-12 sm:pt-28 sm:pb-16">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
          style={{ color: "var(--mkt-olive)" }}
        >
          Three Ways to Sell
        </motion.div>

        {/* Headline + intro */}
        <div className="mt-6 sm:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="lg:col-span-7 font-mkt-display"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
            }}
          >
            Choose the path that fits{" "}
            <motion.em
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEWPORT}
              transition={{
                duration: 0.55,
                delay: 0.45,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="font-mkt-display inline-block"
              style={{ fontStyle: "italic", fontWeight: 700 }}
            >
              your goals.
            </motion.em>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
            className="lg:col-span-5 font-mkt-sans text-sm sm:text-base"
            style={{
              color: "var(--mkt-text-on-light)",
              lineHeight: 1.55,
            }}
          >
            Every homeowner is different. We tailor our approach so you walk
            away with the outcome that actually works for you.
          </motion.p>
        </div>

        {/* Cards */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {OPTIONS.map((opt, i) => (
            <OptionCard key={opt.key} option={opt} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OptionCard({
  option,
  index,
}: {
  option: (typeof OPTIONS)[number];
  index: number;
}) {
  const isDark = option.featured;

  const surfaceBg = isDark ? "var(--mkt-dark)" : "var(--mkt-cream-dim)";
  const titleColor = isDark
    ? "var(--mkt-text-on-dark)"
    : "var(--mkt-text-on-light)";
  const bodyColor = isDark
    ? "var(--mkt-muted-dark)"
    : "var(--mkt-muted-light)";
  const checkBg = isDark
    ? "rgba(245,239,226,0.1)"
    : "rgba(124,139,79,0.18)";
  const ctaBg = isDark ? "var(--mkt-olive)" : "var(--mkt-dark)";
  const ctaText = isDark ? "var(--mkt-cream)" : "var(--mkt-cream)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.7 + index * 0.15,
      }}
      className="h-full"
    >
      {/* Inner wrapper handles the continuous gentle float (each card
          slightly out of phase via index-based delay) plus hover scale.
          Nested so it doesn't fight the entrance animation above. */}
      <motion.div
        animate={{ y: [0, -5, 0, 4, 0] }}
        transition={{
          duration: 7 + index * 0.6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.4,
        }}
        whileHover={{
          scale: 1.035,
          transition: { duration: 0.35, ease: "easeOut" },
        }}
        className="relative rounded-2xl p-5 sm:p-6 lg:p-8 flex flex-col h-full"
        style={{
          background: surfaceBg,
          border: isDark ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
      {option.badge && (
        <div
          className="absolute top-3 right-3 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] font-mkt-sans rounded-full"
          style={{
            background: "var(--mkt-olive)",
            color: "var(--mkt-cream)",
            fontWeight: 600,
          }}
        >
          {option.badge}
        </div>
      )}

      {/* Icon square */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center font-mkt-sans mb-8"
        style={{
          background: option.featured
            ? "var(--mkt-olive)"
            : "rgba(0,0,0,0.04)",
          color: option.featured ? "var(--mkt-cream)" : "var(--mkt-text-on-light)",
          fontWeight: 600,
          fontSize: "1.1rem",
        }}
      >
        {option.icon}
      </div>

      {/* Title + olive sub-head */}
      <h3
        className="font-mkt-display"
        style={{
          color: titleColor,
          fontSize: "clamp(1.6rem, 2.4vw, 2rem)",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {option.title}
      </h3>
      <div
        className="font-mkt-sans mt-1.5"
        style={{
          color: "var(--mkt-olive-light)",
          fontSize: "0.95rem",
          fontWeight: 500,
        }}
      >
        {option.sub}
      </div>

      {/* Description */}
      <p
        className="font-mkt-sans mt-5 text-sm"
        style={{
          color: bodyColor,
          lineHeight: 1.55,
        }}
      >
        {option.desc}
      </p>

      {/* Checklist */}
      <ul className="mt-6 space-y-3 flex-1">
        {option.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-3 font-mkt-sans text-sm"
            style={{ color: titleColor }}
          >
            <span
              className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: checkBg }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--mkt-olive)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href="/sell-property"
        className="mt-7 rounded-full font-mkt-sans text-center py-3.5 transition-opacity hover:opacity-90"
        style={{
          background: ctaBg,
          color: ctaText,
          fontWeight: 500,
          fontSize: "0.95rem",
        }}
      >
        Learn More &nbsp;&rarr;
      </Link>
      </motion.div>
    </motion.div>
  );
}
