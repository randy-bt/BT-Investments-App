"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

/**
 * Infinite RE homepage — static (non-scrollable) hero in the
 * Kove-reference style, reflected: gallery on the left, big serif
 * wordmark on the right.
 *
 * Layout strategy:
 *   - Whole page constrained to flex-1 of the layout (between header
 *     and footer) with overflow-hidden so nothing escapes.
 *   - Three image columns slide vertically at different speeds.
 *   - Container has a negative left offset so the LEFTMOST column
 *     bleeds off the edge — gives a confident "the gallery extends
 *     beyond what you can see" feeling instead of a tidy tile grid.
 *
 * Images come from /public/infinite-re/portfolio/img-NN.webp.
 */

const TOTAL = 18;
function img(n: number) {
  return `/infinite-re/portfolio/img-${String(n).padStart(2, "0")}.webp`;
}

// Mobile gets its own curated, smaller set — 6 polished shots —
// living under /portfolio-mobile so we can keep the desktop wall
// dense without dragging that volume onto cell connections.
const MOBILE_TOTAL = 6;
function mobileImg(n: number) {
  return `/infinite-re/portfolio-mobile/img-${String(n).padStart(2, "0")}.webp`;
}

// Two columns of image numbers — fresh mixes per column, no
// numerical pattern. Each column repeats once so the loop seam is
// invisible at any scroll position.
const COL_A = [1, 5, 9, 13, 17, 3, 11, 15, 7];
const COL_B = [4, 8, 12, 16, 2, 6, 10, 14, 18];

// Mobile-only horizontal row order — leads with the brightest staged
// interior, then alternates exterior / interior for visual rhythm.
const ROW_MIX = [2, 4, 3, 5, 1, 6];

function GalleryColumn({
  imgs,
  duration,
  reverse,
}: {
  imgs: number[];
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="flex flex-col gap-3 will-change-transform"
        animate={{ y: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {[0, 1].map((rep) => (
          <div key={rep} className="flex flex-col gap-3" aria-hidden={rep === 1}>
            {imgs.map((n, i) => {
              // Wrap into available range in case I picked >TOTAL.
              const safe = ((n - 1) % TOTAL) + 1;
              return (
                <div
                  key={`${rep}-${i}`}
                  className="w-full overflow-hidden bg-[#f4f2ee]"
                  style={{ aspectRatio: "3 / 2" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img(safe)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Mobile-only horizontal counterpart to GalleryColumn — a single row
 * of landscape photos that slides sideways. Keeps the gallery feeling
 * alive without forcing a tall vertical strip on phones, where the
 * wordmark needs the room.
 */
function GalleryRow({
  imgs,
  duration,
}: {
  imgs: number[];
  duration: number;
}) {
  // Measurement-based infinite scroll: we render the imgs array
  // twice, measure the strip's actual content width, then animate by
  // exactly half that distance so the second copy slides into the
  // first copy's position with no visual seam. Percentages and CSS
  // keyframes both turned out to be unreliable here (framer-motion's
  // -50% truncated the cycle, and globals.css keyframes weren't being
  // picked up at runtime), so explicit pixels it is.
  const ref = useRef<HTMLDivElement>(null);
  const [halfWidth, setHalfWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      setHalfWidth(ref.current.scrollWidth / 2);
    };
    measure();
    // Re-measure if the viewport changes — the children are vw-sized
    // so the strip width tracks viewport width.
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [imgs]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        ref={ref}
        className="flex flex-row gap-2.5 pr-2.5 will-change-transform h-full"
        animate={halfWidth > 0 ? { x: [0, -halfWidth] } : undefined}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {[...imgs, ...imgs].map((n, i) => {
          const safe = ((n - 1) % MOBILE_TOTAL) + 1;
          return (
            <div
              key={i}
              className="h-full overflow-hidden bg-[#f4f2ee] shrink-0 w-[58vw] sm:w-[42vw]"
              aria-hidden={i >= imgs.length}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mobileImg(safe)}
                alt=""
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

export default function InfiniteReHomePage() {
  return (
    <section className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-0 overflow-hidden">
      {/* LEFT (desktop) / BOTTOM (mobile) — full-bleed BLACK gallery
          panel. On desktop it's a tall left half with two slow
          vertical columns; on mobile it's a single horizontal strip
          that slides sideways so the wordmark above it isn't squeezed. */}
      <div className="order-2 lg:order-1 lg:col-span-7 min-h-0 overflow-hidden bg-black h-[38vh] lg:h-auto shrink-0">
        {/* Desktop: two vertical columns */}
        <div className="hidden lg:grid grid-cols-2 gap-3 h-full p-3">
          <GalleryColumn imgs={COL_A} duration={180} />
          <GalleryColumn imgs={COL_B} duration={220} reverse />
        </div>
        {/* Mobile: single horizontal row */}
        <div className="lg:hidden h-full p-2.5">
          <GalleryRow imgs={ROW_MIX} duration={80} />
        </div>
      </div>

      {/* RIGHT — full-bleed WHITE half. The block of content is
          horizontally centered within this half (items-center), and
          inside the block every line right-aligns (text-right) so the
          wordmark, subtitles, and button all share a hard right edge. */}
      <div
        className="order-1 lg:order-2 lg:col-span-5 flex-1 lg:flex-none flex flex-col justify-center items-center min-h-0 px-2 sm:px-10 lg:px-14 py-6 relative overflow-hidden"
        style={{ background: "#ffffff" }}
      >
        <div className="text-right inline-block max-w-full">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="leading-[0.88] tracking-tighter lg:tracking-tight whitespace-nowrap text-[clamp(5.75rem,16vw,12rem)] lg:text-[clamp(2.75rem,6vw,7rem)]"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 600,
              color: "#161614",
            }}
          >
            Infinite<span
              style={{
                fontStyle: "italic",
                color: "#b49a5c",
                fontWeight: 500,
              }}
            >RE</span><span
              aria-hidden
              className="align-top ml-1 text-[clamp(1.25rem,1.6vw,1.65rem)] lg:text-[clamp(0.7rem,0.85vw,1rem)]"
              style={{
                color: "#b49a5c",
              }}
            >®</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.35 }}
            className="font-sans mt-6 italic text-[clamp(1.65rem,2.35vw,1.85rem)] lg:text-[clamp(0.95rem,1.05vw,1.2rem)]"
            style={{
              color: "#444",
              lineHeight: 1.55,
            }}
          >
            Real estate, in its best light.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.45 }}
            className="font-sans mt-3 text-[clamp(0.7rem,0.85vw,0.78rem)] lg:text-[clamp(0.85rem,0.9vw,1rem)]"
            style={{
              color: "#666",
              lineHeight: 1.55,
            }}
          >
            Crafted photography, film, and brand systems for the
            <br />
            properties and the people who set the standard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.6 }}
            className="mt-8 flex justify-end"
          >
            <Link
              href="/infinite-re/contact"
              className="font-sans inline-flex items-center gap-3 rounded-full px-9 py-4 transition-colors text-[16px] tracking-[0.2em] uppercase font-medium bg-[#161614] hover:bg-[#b49a5c] text-white"
            >
              Book a Shoot
              <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>

        {/* Footer rail — pinned to the bottom of the WHITE half only,
            centered horizontally within it. Stays out of the gallery
            scroll on the left. */}
        <div className="absolute bottom-5 left-0 right-0 px-6 sm:px-10 lg:px-14 flex justify-center pointer-events-none">
          <span
            className="font-sans text-[9px] sm:text-[10px] lg:text-[10.5px] tracking-[0.32em] uppercase"
            style={{ color: "#888" }}
          >
            Photography &nbsp;·&nbsp; Video &nbsp;·&nbsp; Branding
          </span>
        </div>
      </div>
    </section>
  );
}
