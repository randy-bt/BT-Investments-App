import React from "react";

export interface BTWordmarkProps {
  /** hero = full landing treatment with tagline; header = compact nav size; footer = small corner mark */
  size?: "hero" | "header" | "footer";
  /** Render for a dark surface (cream letters) instead of the default light surface */
  onDark?: boolean;
  /** Show the LOCAL • SIMPLE • DIRECT tagline (hero size only) */
  tagline?: boolean;
}

const SIZES = {
  hero: { bt: "7.5rem", inv: "1.6rem", tag: "0.9rem" },
  header: { bt: "3rem", inv: "0.62rem", tag: "0.5rem" },
  footer: { bt: "1.6rem", inv: "0.4rem", tag: "0.3rem" },
} as const;

/**
 * The BT Investments wordmark — "BT" in Cormorant Garamond over a
 * wide-tracked olive "INVESTMENTS", optionally with the site tagline.
 * This is the primary brand mark; use it instead of any icon or logo image.
 */
export function BTWordmark({ size = "header", onDark = false, tagline = false }: BTWordmarkProps) {
  const s = SIZES[size];
  const ink = onDark ? "var(--bt-ink-on-dark)" : "var(--bt-ink)";
  return (
    <div style={{ lineHeight: 1, display: "inline-block" }}>
      <div
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 500,
          fontSize: s.bt,
          letterSpacing: "-0.02em",
          color: ink,
          marginBottom: "-0.12em",
        }}
      >
        BT
      </div>
      <div
        style={{
          fontFamily: "var(--bt-font-sans)",
          fontWeight: 500,
          fontSize: s.inv,
          textTransform: "uppercase",
          letterSpacing: "var(--bt-track-wordmark)",
          color: "var(--bt-olive-bright)",
          marginTop: "0.35em",
        }}
      >
        Investments
      </div>
      {tagline && size === "hero" && (
        <div
          style={{
            fontFamily: "var(--bt-font-sans)",
            fontWeight: 400,
            fontSize: s.tag,
            textTransform: "uppercase",
            letterSpacing: "var(--bt-track-tagline)",
            color: onDark ? "rgba(250,249,244,0.5)" : "rgba(0,0,0,0.42)",
            marginTop: "0.6em",
            whiteSpace: "nowrap",
          }}
        >
          Local&nbsp;&nbsp;•&nbsp;&nbsp;Simple&nbsp;&nbsp;•&nbsp;&nbsp;Direct
        </div>
      )}
    </div>
  );
}
