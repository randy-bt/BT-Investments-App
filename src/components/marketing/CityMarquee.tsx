"use client";

import { motion } from "framer-motion";

/**
 * CityMarquee — infinite left-to-right ticker of city names that BT
 * Investments serves. Sits beneath the WashingtonMap and reinforces
 * the geographic coverage as a quiet, always-moving visual rhythm.
 *
 * Implementation: render the list TWICE inside a flex row, then
 * animate translateX from -50% → 0% on a linear infinite loop. Because
 * the second half is an exact duplicate, the snap back to -50% is
 * visually invisible — the marquee feels truly infinite.
 *
 * Cream-edge gradient masks fade the content in/out at the boundaries
 * so the loop point disappears even further into the design.
 */

const CITIES = [
  "Seattle",
  "Bellevue",
  "Kirkland",
  "Redmond",
  "Sammamish",
  "Bothell",
  "Kenmore",
  "Lynnwood",
  "Edmonds",
  "Mountlake Terrace",
  "Shoreline",
  "Monroe",
  "Burien",
  "Renton",
  "Kent",
  "Auburn",
  "Federal Way",
  "Tacoma",
  "Olympia",
  "Everett",
  "Bellingham",
  "Vancouver",
  "Yakima",
  "Spokane",
];

export function CityMarquee() {
  return (
    <div
      className="relative w-full overflow-hidden py-1"
      style={{
        // Soft fade at the left and right edges so the loop seam
        // dissolves into the page background instead of cutting
        // sharply at the container edges.
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <motion.div
        className="flex shrink-0"
        // Move from -50% → 0% so the visible content scrolls left to
        // right (city names enter from the left, exit on the right).
        animate={{ x: ["-50%", "0%"] }}
        transition={{
          duration: 38,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center"
          >
            {CITIES.map((city) => (
              <li
                key={`${copy}-${city}`}
                className="flex items-center shrink-0 font-mkt-sans uppercase tracking-[0.28em]"
                style={{
                  color: "var(--mkt-text-on-light)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                <span className="px-7 sm:px-9 whitespace-nowrap">{city}</span>
                <span
                  aria-hidden
                  className="block rounded-full"
                  style={{
                    width: 5,
                    height: 5,
                    background: "var(--mkt-olive)",
                  }}
                />
              </li>
            ))}
          </ul>
        ))}
      </motion.div>
    </div>
  );
}
