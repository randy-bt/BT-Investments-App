import React from "react";

export interface StatNumberProps {
  /** The display figure, e.g. "120+" or "$48M" */
  value: string;
  /** Short label under the figure */
  label: string;
  /** Render for a dark section (pale olive figure) — the canonical use */
  onDark?: boolean;
}

/**
 * Display stat — a large Cormorant Garamond figure over a small
 * wide-tracked uppercase label. On dark sections the figure renders in
 * pale olive (#cdcb95), the site's signature treatment for big numbers.
 */
export function StatNumber({ value, label, onDark = true }: StatNumberProps) {
  return (
    <div style={{ display: "inline-block" }}>
      <div
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 500,
          fontSize: "3.5rem",
          lineHeight: 1,
          color: onDark ? "var(--bt-olive-pale)" : "var(--bt-olive)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--bt-font-sans)",
          fontWeight: 500,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "var(--bt-track-label)",
          color: onDark ? "var(--bt-muted-on-dark)" : "var(--bt-muted)",
          marginTop: "0.5rem",
        }}
      >
        {label}
      </div>
    </div>
  );
}
