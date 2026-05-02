"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

/**
 * WashingtonMap — topographic illustration of Washington State with
 * static city markers overlaid. Map and dots are completely still;
 * the only motion is the hover-label that slides in next to a dot.
 *
 * Dot coordinates are in IMAGE-NATURAL space (i.e. where each city
 * sits on the image at scale 1.0). Image and dots both live inside
 * a scale-MAP_ZOOM wrapper, so they zoom together — change MAP_ZOOM
 * to dial how much of the frame the state fills, and dots stay glued
 * to the right geography automatically.
 */

type City = {
  name: string;
  x: number; // % from left of unscaled image
  y: number; // % from top of unscaled image
};

const CITIES: City[] = [
  { name: "Bellingham", x: 37.5, y: 25.9 },
  // North Sound corridor — coords expanded ~15% from the cluster
  // center (39.5, 44) so dots have a little breathing room without
  // losing their geographic relationship.
  { name: "Everett", x: 39.7, y: 38.1 },
  { name: "Monroe", x: 41.5, y: 39.4 },
  { name: "Lynnwood", x: 38.8, y: 39.7 },
  { name: "Edmonds", x: 38.0, y: 40.2 },
  { name: "Mountlake Terrace", x: 38.8, y: 40.9 },
  { name: "Shoreline", x: 38.5, y: 41.5 },
  { name: "Bothell", x: 39.7, y: 41.4 },
  // Eastside
  { name: "Kirkland", x: 39.6, y: 43.0 },
  { name: "Redmond", x: 40.7, y: 43.2 },
  { name: "Sammamish", x: 41.2, y: 44.0 },
  { name: "Bellevue", x: 39.9, y: 44.1 },
  // Seattle + south
  { name: "Seattle", x: 38.8, y: 44.5 },
  { name: "Burien", x: 38.4, y: 46.9 },
  { name: "Renton", x: 39.6, y: 46.6 },
  { name: "Kent", x: 39.5, y: 47.9 },
  { name: "Federal Way", x: 38.9, y: 49.2 },
  { name: "Auburn", x: 39.5, y: 49.1 },
  { name: "Tacoma", x: 37.9, y: 50.0 },
  { name: "Olympia", x: 34.4, y: 53.4 },
  // Outliers
  { name: "Vancouver", x: 36.1, y: 76.1 },
  { name: "Yakima", x: 52.6, y: 60.4 },
  { name: "Spokane", x: 76.1, y: 43.4 },
];

// Container aspect deliberately wider than the source PNG (3072/2060 =
// 1.491). The PNG has transparent margin around the state, so a wider
// container clips that empty space top + bottom (combined with
// MAP_ZOOM > 1 and overflow-hidden on the parent) and the visible map
// section reads much shorter without shrinking the state itself.
const CONTAINER_ASPECT = 1.85;
const MAP_ZOOM = 1.05;
const PRIMARY = new Set(["Seattle", "Bellevue"]);

export function WashingtonMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: CONTAINER_ASPECT }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Both image AND markers live inside this scaled wrapper, so
          they zoom together and the dots stay aligned to the geography
          at any MAP_ZOOM value. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${MAP_ZOOM})`,
          transformOrigin: "center center",
        }}
      >
        <Image
          src="/marketing/wa-topographic-alt.png"
          alt="Topographic map of Washington State"
          fill
          priority
          sizes="(min-width: 1280px) 1400px, 100vw"
          className="object-contain select-none pointer-events-none"
          draggable={false}
        />

        {CITIES.map((c) => (
          <CityMarker
            key={c.name}
            city={c}
            isPrimary={PRIMARY.has(c.name)}
            hovered={hovered === c.name}
            onHoverChange={(h) => setHovered(h ? c.name : null)}
          />
        ))}
      </div>
    </div>
  );
}

function CityMarker({
  city,
  isPrimary,
  hovered,
  onHoverChange,
}: {
  city: City;
  isPrimary: boolean;
  hovered: boolean;
  onHoverChange: (h: boolean) => void;
}) {
  const dotSize = isPrimary ? 18 : 14;

  return (
    <div
      className="absolute"
      style={{
        left: `${city.x}%`,
        top: `${city.y}%`,
        transform: "translate(-50%, -50%)",
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="relative" style={{ cursor: "pointer" }}>
        {/* Static marker — cream-dominant center with a thin olive ring
            and a dark hairline outline (via box-shadow) so it reads on
            both light and dark map regions. */}
        <span
          className="block rounded-full relative"
          style={{
            width: dotSize,
            height: dotSize,
            background: "var(--mkt-cream)",
            border: `${isPrimary ? 2.5 : 2}px solid var(--mkt-olive)`,
            boxShadow: hovered
              ? "0 4px 12px rgba(0,0,0,0.45), 0 0 0 1px rgba(22,22,20,0.55)"
              : "0 2px 6px rgba(0,0,0,0.35), 0 0 0 0.75px rgba(22,22,20,0.45)",
            transform: "translate(-50%, -50%)",
            left: 0,
            top: 0,
          }}
        />

        {hovered && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute font-mkt-sans whitespace-nowrap pointer-events-none"
            style={{
              left: dotSize / 2 + 8,
              top: -dotSize / 2 - 4,
              padding: "5px 12px",
              borderRadius: 999,
              background: "var(--mkt-dark)",
              color: "var(--mkt-cream)",
              fontSize: "0.82rem",
              fontWeight: 600,
              letterSpacing: "0.02em",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            {city.name}
          </motion.span>
        )}
      </div>
    </div>
  );
}
