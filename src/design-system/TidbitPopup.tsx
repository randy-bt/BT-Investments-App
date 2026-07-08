import React from "react";

export interface TidbitPopupProps {
  /** Short message inside the bubble */
  children: React.ReactNode;
  /** Show the downward tail (pointing at whatever the popup annotates) */
  tail?: boolean;
}

/**
 * Olive tidbit popup — the small rounded speech bubble used for hero
 * callout details ("Close in 7 days or 6 months. Your call."). Solid
 * brand olive, white Inter text, soft shadow, optional pointer tail.
 */
export function TidbitPopup({ children, tail = true }: TidbitPopupProps) {
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: 260 }}>
      <div
        style={{
          background: "var(--bt-olive)",
          color: "#ffffff",
          borderRadius: "var(--bt-radius-card)",
          padding: "0.75rem 1rem",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
          fontFamily: "var(--bt-font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.4,
          letterSpacing: "0.005em",
        }}
      >
        {children}
      </div>
      {tail && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "8px solid var(--bt-olive)",
          }}
        />
      )}
    </div>
  );
}
