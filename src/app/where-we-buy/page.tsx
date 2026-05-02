"use client";

import { motion } from "framer-motion";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { WashingtonMap } from "@/components/marketing/WashingtonMap";
import { CityMarquee } from "@/components/marketing/CityMarquee";
import { CTA1Inline } from "@/components/marketing/CTA1Inline";
import { FooterBody } from "@/components/marketing/FooterSection";

const VIEWPORT = { once: true, amount: 0.25 };

export default function WhereWeBuyPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      {/* Header — eyebrow + title + subhead. Each line cascades in on
          mount; staggered so the eye lands on them one at a time. */}
      <section
        className="w-full"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-28 sm:pt-32 pb-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
            style={{ color: "var(--mkt-olive)" }}
          >
            Where We Buy
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
            Rooted in the{" "}
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
              Pacific Northwest.
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
            We buy homes throughout Western Washington, from Seattle and
            Bellevue to Kirkland and the communities around them. If your
            property is in the area, we&apos;d love to make you an offer.
          </motion.p>
        </div>
      </section>

      {/* Map — fades up as the user scrolls into view. Wider container
          + reduced padding makes the topographic image read bigger. */}
      <section
        className="w-full"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 pb-0">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <WashingtonMap />
          </motion.div>
        </div>

        {/* Infinite-loop city ticker — full-bleed (escapes the map's
            max-w container) so the names flow edge to edge. */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
        >
          <CityMarquee />
        </motion.div>
      </section>

      {/* Small spacer between the marquee and CTA1 — Where We Buy only,
          since the marquee sits directly above the CTA on this page. */}
      <div
        className="w-full pt-5 sm:pt-7"
        style={{ background: "var(--mkt-cream)" }}
      />

      {/* CTA1 — bottom-of-page conversion card */}
      <CTA1Inline
        eyebrow="Don't see your area?"
        title={
          <>
            We may{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "var(--mkt-olive-light)", fontStyle: "italic" }}
            >
              still
            </em>{" "}
            buy your home.
          </>
        }
        body="Even if your city isn't on the map, send us your address. If it's anywhere in Washington (or nearby), there's a good chance we can make you a fair, no-obligation offer."
      />

      <FooterBody />
    </div>
  );
}
