import React from "react";
import { BTWordmark } from "./BTWordmark";
import { BrandDivider } from "./BrandDivider";

export interface LetterheadHeaderProps {
  /** Right-aligned contact block lines (e.g. address, phone, email) */
  contactLines?: string[];
}

/**
 * Print letterhead header — the BT wordmark on the left, a muted Inter
 * contact block on the right, closed by a full-width olive rule.
 * The top of every branded document and one-pager.
 */
export function LetterheadHeader({
  contactLines = ["BT Investments", "Lynnwood, WA", "btinvestments.co"],
}: LetterheadHeaderProps) {
  return (
    <header style={{ background: "var(--bt-cream)", padding: "0.5rem 0 1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "1.1rem",
        }}
      >
        <BTWordmark size="header" />
        <div
          style={{
            fontFamily: "var(--bt-font-sans)",
            fontSize: "0.72rem",
            lineHeight: 1.7,
            textAlign: "right",
            color: "var(--bt-muted)",
          }}
        >
          {contactLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>
      <BrandDivider width="100%" />
    </header>
  );
}
