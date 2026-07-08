import React from "react";

export interface MarketingButtonProps {
  children: React.ReactNode;
  /** primary = solid olive; onDark = pale-olive fill for dark sections; ghost = outlined */
  variant?: "primary" | "onDark" | "ghost";
  size?: "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Marketing CTA button — always a pill (fully rounded), Inter medium.
 * primary: solid brand olive with cream text (light sections).
 * onDark: pale olive fill with dark text (dark sections).
 * ghost: transparent with an ink outline.
 */
export function MarketingButton({
  children,
  variant = "primary",
  size = "md",
  onClick,
  disabled = false,
}: MarketingButtonProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--bt-olive)", color: "#ffffff", border: "1px solid transparent" },
    onDark: { background: "var(--bt-olive-pale)", color: "var(--bt-dark)", border: "1px solid transparent" },
    ghost: { background: "transparent", color: "var(--bt-ink)", border: "1px solid var(--bt-ink)" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "var(--bt-font-sans)",
        fontWeight: 500,
        fontSize: size === "lg" ? "1.05rem" : "0.95rem",
        padding: size === "lg" ? "0.85rem 2rem" : "0.75rem 1.5rem",
        borderRadius: "var(--bt-radius-pill)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 150ms ease",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}
