"use client";

import { useState } from "react";

/**
 * WashingtonMap — Stylized SVG approximation of Washington State with
 * city markers for the cities BT Investments serves. Placeholder for
 * the eventual interactive city-hover / city-limit treatment. Each
 * marker has a hover state showing the city name in a tooltip; for now
 * that's the extent of the interactivity.
 *
 * Coordinate system: viewBox 1000x600. Cities placed by approximate
 * relative position within the state, NOT by real geographic
 * coordinates — close enough to look right, easy to retune later.
 */

type City = {
  name: string;
  // % of viewBox width / height
  x: number;
  y: number;
  primary?: boolean;
};

const CITIES: City[] = [
  // Puget Sound focus area — clustered around 28-36% x, 25-50% y
  { name: "Bellingham", x: 31, y: 8 },
  { name: "Everett", x: 30, y: 25 },
  { name: "Kirkland", x: 33, y: 30 },
  { name: "Bellevue", x: 33.5, y: 33 },
  { name: "Seattle", x: 30, y: 32, primary: true },
  { name: "Renton", x: 33, y: 36 },
  { name: "Kent", x: 32, y: 39 },
  { name: "Federal Way", x: 30, y: 42 },
  { name: "Auburn", x: 33, y: 42 },
  { name: "Tacoma", x: 30, y: 45, primary: true },
  { name: "Olympia", x: 26, y: 51 },
  // Outliers
  { name: "Vancouver", x: 38, y: 88 },
  { name: "Yakima", x: 56, y: 60 },
  { name: "Spokane", x: 88, y: 27 },
];

export function WashingtonMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-auto block"
        aria-label="Map of Washington State showing cities BT Investments serves"
      >
        {/* State silhouette — stylized polygon approximating WA's shape.
            Olympic Peninsula notch at top-left, Puget Sound inset on
            the west side, Columbia River curve on the south. */}
        <path
          d="M 60 130
             L 100 95
             L 160 80
             L 230 90
             L 260 130
             L 300 110
             L 340 95
             L 410 90
             L 480 95
             L 560 90
             L 640 95
             L 720 95
             L 800 100
             L 880 105
             L 940 115
             L 950 540
             L 870 550
             L 760 545
             L 660 540
             L 550 545
             L 440 540
             L 360 545
             L 290 530
             L 240 510
             L 200 480
             L 175 440
             L 165 400
             L 175 360
             L 200 320
             L 220 290
             L 215 260
             L 195 235
             L 165 215
             L 130 195
             L 95 175
             L 70 155
             Z"
          fill="var(--mkt-cream-dim)"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="2"
        />

        {/* Olympic Peninsula highlight (the small blob on the upper-left) */}
        <path
          d="M 70 155 L 60 200 L 80 240 L 130 230 L 145 195 L 130 195 L 95 175 Z"
          fill="var(--mkt-cream-dim)"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="2"
        />

        {/* Puget Sound water inset — subtle blue-gray to suggest the inland water */}
        <path
          d="M 215 200 L 230 240 L 245 280 L 240 320 L 230 360 L 235 410 L 250 450 L 245 480 L 270 500 L 290 520
             L 305 470 L 295 410 L 285 350 L 280 290 L 270 240 L 240 210 Z"
          fill="rgba(140,170,180,0.18)"
        />

        {/* City markers */}
        {CITIES.map((c) => {
          const isHovered = hovered === c.name;
          const cx = (c.x / 100) * 1000;
          const cy = (c.y / 100) * 600;
          const r = c.primary ? 9 : 6;

          return (
            <g
              key={c.name}
              onMouseEnter={() => setHovered(c.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Marker outer ring */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? r + 3 : r}
                fill="var(--mkt-cream)"
                stroke="var(--mkt-olive)"
                strokeWidth={c.primary ? 3.5 : 2.5}
                style={{ transition: "r 0.15s ease, stroke-width 0.15s ease" }}
              />
              {/* Marker inner dot */}
              <circle
                cx={cx}
                cy={cy}
                r={c.primary ? 3 : 2}
                fill="var(--mkt-olive)"
              />
              {/* Always-visible city name for primary cities */}
              {c.primary && (
                <text
                  x={cx + 14}
                  y={cy + 5}
                  className="font-mkt-sans"
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    fill: "var(--mkt-text-on-light)",
                  }}
                >
                  {c.name}
                </text>
              )}
              {/* Hover label for non-primary cities */}
              {!c.primary && isHovered && (
                <g>
                  <rect
                    x={cx + 12}
                    y={cy - 14}
                    width={c.name.length * 8 + 16}
                    height={24}
                    rx={4}
                    fill="var(--mkt-dark)"
                  />
                  <text
                    x={cx + 20}
                    y={cy + 3}
                    className="font-mkt-sans"
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      fill: "var(--mkt-cream)",
                    }}
                  >
                    {c.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
