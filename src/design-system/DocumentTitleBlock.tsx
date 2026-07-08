import React from "react";
import { BrandDivider } from "./BrandDivider";

export interface DocumentTitleBlockProps {
  /** Document title, e.g. "Purchase & Sale Agreement" */
  title: string;
  /** Small uppercase line above the title, e.g. "BT INVESTMENTS" */
  kicker?: string;
  /** Meta line under the title, e.g. a date or reference number */
  meta?: string;
}

/**
 * Centered document title block — kicker, Cormorant title, olive divider
 * with diamond, and an optional meta line. For agreements, reports, and
 * formal print collateral.
 */
export function DocumentTitleBlock({ title, kicker = "BT Investments", meta }: DocumentTitleBlockProps) {
  return (
    <div
      style={{
        background: "var(--bt-cream)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.9rem",
        padding: "0.5rem 0",
      }}
    >
      <div
        style={{
          fontFamily: "var(--bt-font-sans)",
          fontWeight: 600,
          fontSize: "0.68rem",
          textTransform: "uppercase",
          letterSpacing: "var(--bt-track-eyebrow)",
          color: "var(--bt-olive-bright)",
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 500,
          fontSize: "2.2rem",
          lineHeight: 1.1,
          color: "var(--bt-ink)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <BrandDivider diamond width={220} />
      {meta && (
        <div
          style={{
            fontFamily: "var(--bt-font-sans)",
            fontSize: "0.8rem",
            color: "var(--bt-muted)",
          }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}
