import React from "react";

export interface MarketingSectionProps {
  children: React.ReactNode;
  /** cream = warm light band; creamDim = dimmed cream surface; dark = near-black band */
  tone?: "cream" | "creamDim" | "dark";
  /** Vertical padding preset */
  pad?: "normal" | "roomy";
}

/**
 * Marketing section band — the alternating cream/dark full-width sections
 * the site is built from. Sets background, text color, and the Inter base
 * font for everything inside; children use the other brand components.
 */
export function MarketingSection({ children, tone = "cream", pad = "normal" }: MarketingSectionProps) {
  const bg =
    tone === "dark" ? "var(--bt-dark)" : tone === "creamDim" ? "var(--bt-cream-dim)" : "var(--bt-cream)";
  const ink = tone === "dark" ? "var(--bt-ink-on-dark)" : "var(--bt-ink)";
  return (
    <section
      style={{
        background: bg,
        color: ink,
        fontFamily: "var(--bt-font-sans)",
        padding: pad === "roomy" ? "6rem 2.5rem" : "4rem 2.5rem",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>{children}</div>
    </section>
  );
}
