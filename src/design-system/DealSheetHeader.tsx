import React from "react";
import { Eyebrow } from "./Eyebrow";

export interface DealSheetHeaderProps {
  /** Property street address (the document's headline) */
  address: string;
  /** City/state line under the address */
  cityState?: string;
  /** Asking price, shown large in brand olive */
  price: string;
  /** Quick stats, e.g. [{label:"Beds",value:"3"},{label:"Baths",value:"2"}] */
  stats?: { label: string; value: string }[];
}

/**
 * Deal sheet header — the top block of a property one-pager: eyebrow,
 * Cormorant address headline, olive price, and a compact stat row.
 * Built for print/PDF collateral sent to investors.
 */
export function DealSheetHeader({
  address,
  cityState,
  price,
  stats = [],
}: DealSheetHeaderProps) {
  return (
    <div style={{ background: "var(--bt-cream)", fontFamily: "var(--bt-font-sans)" }}>
      <Eyebrow>Off-Market Opportunity</Eyebrow>
      <h1
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 500,
          fontSize: "2.6rem",
          lineHeight: 1.05,
          color: "var(--bt-ink)",
          margin: "0.9rem 0 0",
        }}
      >
        {address}
      </h1>
      {cityState && (
        <div style={{ fontSize: "1rem", color: "var(--bt-muted)", marginTop: "0.35rem" }}>
          {cityState}
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 600,
          fontSize: "2rem",
          color: "var(--bt-olive)",
          marginTop: "1rem",
        }}
      >
        {price}
      </div>
      {stats.length > 0 && (
        <div style={{ display: "flex", gap: "2rem", marginTop: "1.25rem" }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--bt-ink)" }}>
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  textTransform: "uppercase",
                  letterSpacing: "var(--bt-track-label)",
                  color: "var(--bt-muted)",
                  marginTop: "0.2rem",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
