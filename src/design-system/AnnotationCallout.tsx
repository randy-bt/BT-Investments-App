import React from "react";

export interface AnnotationCalloutProps {
  /** The label text (Raleway bold, e.g. "Any Condition") */
  label: string;
  /** Vertical connector line length in px */
  lineLength?: number;
}

/**
 * Hero annotation callout — a bold Raleway label with a thin vertical
 * connector line dropping to an olive "donut" ring target. The signature
 * pattern used to point at features of the hero photograph.
 */
export function AnnotationCallout({ label, lineLength = 90 }: AnnotationCalloutProps) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span
        style={{
          fontFamily: "var(--bt-font-annotation)",
          fontWeight: 700,
          fontSize: "1.1rem",
          letterSpacing: "0.01em",
          color: "var(--bt-ink)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          width: 2,
          height: lineLength,
          background: "var(--bt-ink)",
          opacity: 0.55,
          marginLeft: 10,
          marginTop: 6,
        }}
      />
      <span
        style={{
          width: 31,
          height: 31,
          marginLeft: -4,
          borderRadius: "50%",
          background: "#dcd6c8",
          border: "10px solid var(--bt-olive)",
          boxSizing: "border-box",
          display: "block",
        }}
      />
    </div>
  );
}
