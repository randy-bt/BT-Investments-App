import React from "react";

export interface BrandDividerProps {
  /** Line width */
  width?: number | string;
  /** Render for a dark surface (pale olive line) */
  onDark?: boolean;
  /** Add the small centered diamond accent */
  diamond?: boolean;
}

/**
 * Brand divider — a thin olive rule, optionally with a small centered
 * diamond. Used between document sections and on print collateral.
 */
export function BrandDivider({ width = 240, onDark = false, diamond = false }: BrandDividerProps) {
  const color = onDark ? "var(--bt-olive-pale)" : "var(--bt-olive)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width }}>
      <span style={{ flex: 1, height: 1, background: color, opacity: 0.7 }} />
      {diamond && (
        <>
          <span
            style={{
              width: 6,
              height: 6,
              background: color,
              transform: "rotate(45deg)",
              display: "block",
            }}
          />
          <span style={{ flex: 1, height: 1, background: color, opacity: 0.7 }} />
        </>
      )}
    </div>
  );
}
