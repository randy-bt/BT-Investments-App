"use client";

import { motion } from "framer-motion";
import Image from "next/image";

/**
 * Hero (Landing) section
 *
 *  - "BT" big serif wordmark + "INVESTMENTS" caps subtitle + "LOCAL • SIMPLE • DIRECT"
 *  - Three callouts (Any Condition / Flexible Terms / Your Timeline) overlaying the photo.
 *    Each callout = label + connector line + olive donut target.
 *
 * STAGE PATTERN (locks callouts to the image):
 *   The image and the callouts are both rendered inside an absolutely-
 *   positioned "stage" wrapper that has the image's natural aspect ratio
 *   (3072:2300). Because both share the same stage coordinate system,
 *   callouts are positioned as percentages of the stage and stay glued to
 *   the same building features regardless of viewport size or how the
 *   stage scales.
 *
 *   Two stage instances are rendered with identical positioning classes
 *   so they overlay perfectly:
 *     - Image stage at z-0 (back, behind the title)
 *     - Callouts stage at z-20 (front, above the title)
 *   The title sits at z-10 between them.
 *
 *   STAGE_CLASSES caps width at 2400px so on ultra-wide viewports the
 *   stage stops growing, preventing the building from dominating the page
 *   and covering the title.
 */

// Shared positioning for the image stage and the callouts stage. Keeping
// these identical is what locks callouts to the image — both elements
// occupy the exact same rectangle, just at different z-index layers.
const STAGE_CLASSES =
  "absolute bottom-0 md:bottom-[-25vh] lg:bottom-[-40vh] left-1/2 -translate-x-1/2 w-[150%] md:w-[115%] lg:w-[110%] aspect-[3072/2300] max-w-[2400px]";

// Each callout has three Tailwind class strings — one for the label,
// one for the connector line, one for the donut — covering position
// (top/left) and any responsive `lg:` overrides for desktop tweaks.
//
// Line top = labelTop + 1.5rem (clears the label glyph height).
// Line height = donutTop - labelTop - 1.5rem (terminates at donut).
const CALLOUTS = [
  {
    label: "Any Condition",
    // Desktop: small leftward shift (less aggressive than before) and
    // labelTop nudged up so the larger desktop font has the same visual
    // gap above the line as the smaller mobile/tablet font.
    labelClass: "top-[15%] left-[30%] lg:top-[13%] lg:left-[26%]",
    lineClass:
      "top-[calc(15%_+_1.5rem)] h-[calc(30%_-_1.5rem)] left-[31%] lg:left-[27%]",
    donutClass: "top-[45%] left-[31%] lg:left-[27%]",
  },
  {
    label: "Flexible Terms",
    // Desktop: whole callout shifted down 4% (label, line top, donut)
    labelClass: "top-[20%] left-[55%] lg:top-[22%]",
    lineClass:
      "top-[calc(20%_+_1.5rem)] h-[calc(28%_-_1.5rem)] lg:top-[calc(24%_+_1.5rem)] left-[56%]",
    donutClass: "top-[48%] lg:top-[52%] left-[56%]",
  },
  {
    label: "Your Timeline",
    // Desktop: whole callout shifted down 4% (label, line top). Donut
    // sits noticeably below Strategic's donut while staying within the
    // visible stage.
    labelClass: "top-[25%] left-[64%] lg:top-[27%] lg:left-[68%]",
    lineClass:
      "top-[calc(25%_+_1.5rem)] h-[calc(37%_-_1.5rem)] lg:top-[calc(29%_+_1.5rem)] lg:h-[calc(26%_-_1.5rem)] left-[66%] lg:left-[70%]",
    donutClass: "top-[62%] lg:top-[55%] left-[66%] lg:left-[70%]",
  },
];

export function HeroSection() {
  return (
    <section
      className="relative w-full overflow-hidden flex flex-col"
      style={{
        background: "var(--mkt-cream)",
        minHeight: "100vh",
      }}
    >
      {/* Layer 1 — house image stage (z-0). Fades in on mount. */}
      <motion.div
        className={`${STAGE_CLASSES} z-0`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <Image
          src="/marketing/hero-house.png"
          alt="Modern architectural home — concrete and wood facade at twilight"
          fill
          priority
          sizes="(min-width: 1024px) 149vw, (min-width: 768px) 115vw, 150vw"
          className="object-cover"
        />
      </motion.div>

      {/* Layer 2 — Wordmark wrapper (z-10).
          Fail-safe: when the viewport gets extremely short (max-height
          450px), the title fades out so the image carries the hero on
          its own — preserves a clean look on intentionally-stretched
          windows where the title would otherwise be overlapped by the
          building. */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-10 pt-24 sm:pt-24 flex justify-center transition-opacity duration-300 max-sm:[@media(max-height:650px)]:opacity-0 max-sm:[@media(max-height:650px)]:pointer-events-none sm:[@media(max-height:750px)]:opacity-0 sm:[@media(max-height:750px)]:pointer-events-none sm:[@media(min-aspect-ratio:2.4/1)]:opacity-0 sm:[@media(min-aspect-ratio:2.4/1)]:pointer-events-none [@media(min-width:1920px)_and_(max-height:1000px)]:opacity-0 [@media(min-width:1920px)_and_(max-height:1000px)]:pointer-events-none [@media(min-width:1920px)_and_(min-aspect-ratio:2.4/1)]:opacity-0 [@media(min-width:1920px)_and_(min-aspect-ratio:2.4/1)]:pointer-events-none">
        <div className="text-left mt-10 sm:mt-10">
          <motion.h1
            className="font-mkt-display leading-none tracking-tight"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            style={{
              color: "var(--mkt-text-on-light)",
              fontSize: "clamp(5.55rem, 20vw, 12.35rem)",
              fontWeight: 500,
              // Negative margin pulls INVESTMENTS up close to BT so the
              // BT→INVESTMENTS visual gap matches INVESTMENTS→BUY•RENT•SELL
              marginBottom: "-0.12em",
            }}
          >
            BT
          </motion.h1>
          <motion.div
            className="font-mkt-sans uppercase mt-2 tracking-[0.5em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            style={{
              // Brighter, less-warm olive for the INVESTMENTS eyebrow —
              // kept separate from --mkt-olive so it doesn't drag the
              // rest of the brand-olive elements with it
              color: "#76794c",
              fontSize: "clamp(1.47rem, 3.7vw, 2.09rem)",
              fontWeight: 500,
            }}
          >
            Investments
          </motion.div>
          <motion.div
            className="font-mkt-sans uppercase mt-2 tracking-[0.38em]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
            style={{
              color: "rgba(0, 0, 0, 0.42)",
              fontSize: "clamp(0.92rem, 2.05vw, 1.16rem)",
              fontWeight: 400,
            }}
          >
            Local &nbsp;•&nbsp; Simple &nbsp;•&nbsp; Direct
          </motion.div>
        </div>
      </div>

      {/* Spacer so section reaches min-h-screen even with stages absolute */}
      <div className="flex-1 min-h-[40vh]" />

      {/* Layer 3 — Callouts stage (z-20). Same positioning as image stage,
          so callouts stay locked to the same image coordinate system.
          Fail-safe: fades out at max-height 600px (well before the title
          fades) so the image stands alone before the title even thinks
          about crowding it. */}
      <div className={`${STAGE_CLASSES} z-20 pointer-events-none transition-opacity duration-300 max-sm:[@media(max-height:750px)]:opacity-0 sm:[@media(max-height:900px)]:opacity-0 [@media(min-width:640px)_and_(max-width:1919px)_and_(min-aspect-ratio:1.9/1)]:opacity-0 [@media(min-width:1920px)_and_(max-height:1100px)]:opacity-0 [@media(min-width:1920px)_and_(min-aspect-ratio:2/1)]:opacity-0`}>
        {CALLOUTS.map((c, i) => (
          <Callout key={c.label} callout={c} index={i} />
        ))}
      </div>
    </section>
  );
}

function Callout({
  callout,
  index,
}: {
  callout: (typeof CALLOUTS)[number];
  index: number;
}) {
  const { label, labelClass, lineClass, donutClass } = callout;

  return (
    <>
      {/* Label */}
      <motion.div
        className={`absolute pointer-events-auto ${labelClass}`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: 0.4 + index * 0.15,
          ease: "easeOut",
        }}
      >
        <motion.span
          animate={{ y: [0, -3, 0] }}
          transition={{
            duration: 4 + index * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="block font-mkt-annotation"
          style={{ color: "var(--mkt-text-on-light)" }}
        >
          <span
            className="text-sm sm:text-base lg:text-[21px]"
            style={{ fontWeight: 700, letterSpacing: "0.01em" }}
          >
            {label}
          </span>
        </motion.span>
      </motion.div>

      {/* Connector line — vertical CSS div from below the label down to
          the donut. Grows down on mount via scaleY from origin top. */}
      <motion.div
        className={`absolute pointer-events-none w-[2px] ${lineClass}`}
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 0.55, scaleY: 1 }}
        transition={{
          duration: 0.55,
          delay: 0.55 + index * 0.15,
          ease: "easeOut",
        }}
        style={{
          background: "var(--mkt-text-on-light)",
          transform: "translateX(-50%)",
          transformOrigin: "top center",
        }}
      />

      {/* Donut target. Top edge sits exactly at donutTop so the line
          terminates flush with the donut's top. Pops in after the line. */}
      <motion.span
        className={`absolute block rounded-full border-solid w-[24px] h-[24px] sm:w-[31px] sm:h-[31px] border-[7px] sm:border-[10px] ${donutClass}`}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.95 + index * 0.15,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        style={{
          transform: "translateX(-50%)",
          transformOrigin: "center center",
          background: "#dcd6c8",
          borderColor:
            "color-mix(in srgb, var(--mkt-olive) 85%, transparent)",
        }}
      />
    </>
  );
}
