"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
//
// `lg:portrait:` overrides target iPad Pro 13" portrait (1024×1366),
// where the lg landscape values left the building image as a thin
// 297px sliver at the bottom of a tall viewport. Widening the stage
// (140% vs 110%) and reducing the bleed below (-25vh vs -40vh) gives
// the image proper presence in this aspect ratio without affecting
// landscape iPad or desktop layouts.
const STAGE_CLASSES =
  "absolute bottom-0 md:bottom-[-25vh] lg:bottom-[-40vh] lg:portrait:bottom-[-25vh] left-1/2 -translate-x-1/2 w-[150%] md:w-[115%] lg:w-[110%] lg:portrait:w-[140%] aspect-[3072/2300] max-w-[2400px]";

// Each callout has three Tailwind class strings — one for the label,
// one for the connector line, one for the donut — covering position
// (top/left) and any responsive `lg:` overrides for desktop tweaks.
//
// Line top = labelTop + 1.5rem (clears the label glyph height).
// Line height = donutTop - labelTop - 1.5rem (terminates at donut).
const CALLOUTS = [
  {
    label: "Any Condition",
    tidbit:
      "Fire damage, hoarder situations, even full tear downs. We've seen it all.",
    // Mobile: label at 15%, line drops to donut at 45%.
    // Tablet landscape (lg through xl, ~1024-1535px): label lowered
    // to 22% so it sits closer to the donut on iPad-class viewports
    // where the previous placement read as floating too high above
    // the building. Line shortened to match (still terminates at 45%).
    // Large desktop (2xl, 1536+): reverts to the original 13% so big
    // monitors keep the airy spacing they were designed for.
    labelClass:
      "top-[15%] left-[30%] lg:top-[22%] lg:left-[26%] 2xl:top-[13%]",
    lineClass:
      "top-[calc(15%_+_1.5rem)] h-[calc(30%_-_1.5rem)] left-[31%] lg:left-[27%] lg:top-[calc(22%_+_1.5rem)] lg:h-[calc(23%_-_1.5rem)] 2xl:top-[calc(15%_+_1.5rem)] 2xl:h-[calc(30%_-_1.5rem)]",
    donutClass: "top-[45%] left-[31%] lg:left-[27%]",
    // % of popup width to nudge the popup horizontally on mobile to
    // keep it inside the viewport. 0 = centered. Negative = shift left,
    // positive = shift right. Tuned per-callout based on the donut's
    // horizontal position relative to the viewport.
    mobilePopupOffsetPct: 30,
  },
  {
    label: "Flexible Terms",
    tidbit:
      "Cash, owner financing, or creative structures. We meet you where you are.",
    // Desktop: whole callout shifted down 4% (label, line top, donut)
    labelClass: "top-[20%] left-[55%] lg:top-[22%]",
    lineClass:
      "top-[calc(20%_+_1.5rem)] h-[calc(28%_-_1.5rem)] lg:top-[calc(24%_+_1.5rem)] left-[56%]",
    donutClass: "top-[48%] lg:top-[52%] left-[56%]",
    mobilePopupOffsetPct: -25,
  },
  {
    label: "Your Timeline",
    tidbit: "Close in 7 days or 6 months. Your call.",
    // Desktop: whole callout shifted down 4% (label, line top). Donut
    // sits noticeably below Strategic's donut while staying within the
    // visible stage.
    labelClass: "top-[25%] left-[64%] lg:top-[27%] lg:left-[68%]",
    lineClass:
      "top-[calc(25%_+_1.5rem)] h-[calc(37%_-_1.5rem)] lg:top-[calc(29%_+_1.5rem)] lg:h-[calc(26%_-_1.5rem)] left-[66%] lg:left-[70%]",
    donutClass: "top-[62%] lg:top-[55%] left-[66%] lg:left-[70%]",
    mobilePopupOffsetPct: -55,
  },
];

export function HeroSection() {
  // Which donut tidbit is currently visible. null = none.
  const [openDonut, setOpenDonut] = useState<number | null>(null);

  // Click anywhere outside a donut/popup closes the open tidbit. Using
  // a deferred listener so the click that opened it doesn't immediately
  // close it.
  useEffect(() => {
    if (openDonut === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-donut]") ||
        target.closest("[data-donut-popup]")
      ) {
        return;
      }
      setOpenDonut(null);
    };
    const t = window.setTimeout(
      () => document.addEventListener("click", handler),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("click", handler);
    };
  }, [openDonut]);

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
            className="font-mkt-sans uppercase mt-2 tracking-[0.38em] whitespace-nowrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: "easeOut" }}
            style={{
              color: "rgba(0, 0, 0, 0.42)",
              fontSize: "clamp(0.78rem, 2.05vw, 1.16rem)",
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
          <Callout
            key={c.label}
            callout={c}
            index={i}
            isOpen={openDonut === i}
            onToggle={() => setOpenDonut(openDonut === i ? null : i)}
          />
        ))}
      </div>
    </section>
  );
}

function Callout({
  callout,
  index,
  isOpen,
  onToggle,
}: {
  callout: (typeof CALLOUTS)[number];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { label, tidbit, labelClass, lineClass, donutClass, mobilePopupOffsetPct } = callout;
  // Mobile-only horizontal nudge for the tidbit popup. The right-side
  // callouts would otherwise overflow the viewport because the popup is
  // centered on a donut that's already close to the right edge.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const popupOffsetPct = isNarrow ? mobilePopupOffsetPct : 0;

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

      {/* Donut target. Now a button — clicking toggles a small green
          tidbit popup floating above it. Top edge of the donut sits
          exactly at donutTop so the line terminates flush. */}
      <motion.button
        type="button"
        data-donut
        aria-label={`${label} info`}
        aria-expanded={isOpen}
        onClick={onToggle}
        className={`absolute block rounded-full border-solid w-[24px] h-[24px] sm:w-[31px] sm:h-[31px] border-[7px] sm:border-[10px] pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-transform ${donutClass}`}
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
      >
        {/* Popup — child of the donut button so it inherits the donut's
            absolute placement automatically. bottom-full lifts it above
            the donut; left-1/2 + -translate-x-1/2 centers it. Tail
            triangle points back down at the donut. */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              data-donut-popup
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-full left-1/2 mb-3 sm:mb-4 z-30"
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                transform: `translateX(${-50 + popupOffsetPct}%)`,
              }}
            >
              <div
                className="relative rounded-2xl shadow-xl px-4 py-3 pr-9 w-[min(56vw,200px)] sm:w-[260px]"
                style={{
                  background: "var(--mkt-olive)",
                  color: "#ffffff",
                }}
              >
                <p
                  className="font-mkt-sans text-[13px] sm:text-[13.5px] leading-snug"
                  style={{ letterSpacing: "0.005em" }}
                >
                  {tidbit}
                </p>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                {/* Tail triangle — sits below the bubble, pointing at
                    the donut. Same color as the bubble. */}
                <span
                  aria-hidden
                  className="absolute top-full w-0 h-0"
                  style={{
                    // Keep the tail anchored to the donut even when the
                    // popup itself is shifted off-center on mobile.
                    left: `${50 - popupOffsetPct}%`,
                    transform: "translateX(-50%)",
                    borderLeft: "7px solid transparent",
                    borderRight: "7px solid transparent",
                    borderTop: "8px solid var(--mkt-olive)",
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
