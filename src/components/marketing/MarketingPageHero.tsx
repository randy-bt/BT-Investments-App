"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Animated page hero used on inner marketing pages that are server
 * components (i.e. ones with `metadata` exports — sell-property,
 * join-buyers-list). Mirrors the header pattern from /faq and
 * /where-we-buy: small olive eyebrow, big serif headline with an
 * italic-olive emphasis at the end, body paragraph below. Each line
 * cascades in on mount.
 */
export function MarketingPageHero({
  eyebrow,
  headlineLead,
  headlineEm,
  body,
  emOnNewLine,
}: {
  eyebrow: string;
  headlineLead: string;
  headlineEm: string;
  body: ReactNode;
  /**
   * When true, render the italic emphasis on its own line beneath the
   * lead. Used by /join-buyers-list to get the "Get first access to /
   * off-market deals." two-line stack.
   */
  emOnNewLine?: boolean;
}) {
  return (
    <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
      <div className="mx-auto max-w-3xl px-6 sm:px-10 pt-28 sm:pt-32 pb-8 sm:pb-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
          style={{ color: "var(--mkt-olive)" }}
        >
          {eyebrow}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="font-mkt-display mt-5 sm:mt-6"
          style={{
            fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
            lineHeight: 1.05,
            fontWeight: 700,
            color: "var(--mkt-text-on-light)",
          }}
        >
          {headlineLead}
          {emOnNewLine ? <br /> : " "}
          <motion.em
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 0.5,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className="font-mkt-display italic inline-block"
            style={{ color: "#8a9550", fontStyle: "italic" }}
          >
            {headlineEm}
          </motion.em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
          className="font-mkt-sans mt-6 max-w-2xl text-base sm:text-lg"
          style={{
            color: "var(--mkt-muted-light)",
            lineHeight: 1.55,
          }}
        >
          {body}
        </motion.p>
      </div>
    </section>
  );
}

/**
 * Generic scroll-triggered fade-up wrapper. Use to animate content
 * (forms, cards, sections) that should reveal as the user scrolls
 * them into view.
 */
export function FadeUpOnView({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
