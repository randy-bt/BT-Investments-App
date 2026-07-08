import React from "react";

export interface EyebrowProps {
  children: React.ReactNode;
  /** Render for a dark section (pale olive) instead of the default light section (olive) */
  onDark?: boolean;
}

/**
 * Section eyebrow — the small, widely letter-spaced uppercase label that
 * opens every marketing section (e.g. "WHY HOMEOWNERS CHOOSE US").
 * Always Inter, always uppercase, always tracked at 0.32em.
 */
export function Eyebrow({ children, onDark = false }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: "var(--bt-font-sans)",
        fontWeight: 600,
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: "var(--bt-track-eyebrow)",
        color: onDark ? "var(--bt-olive-pale)" : "var(--bt-olive)",
      }}
    >
      {children}
    </div>
  );
}
