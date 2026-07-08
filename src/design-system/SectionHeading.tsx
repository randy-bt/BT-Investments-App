import React from "react";
import { Eyebrow } from "./Eyebrow";

export interface SectionHeadingProps {
  /** The eyebrow line above the heading (uppercase, olive) */
  eyebrow?: string;
  /** Main heading text (Cormorant Garamond display serif) */
  children: React.ReactNode;
  /** A phrase rendered in italic olive Cormorant — the site's signature emphasis */
  emphasis?: string;
  /** Render for a dark section */
  onDark?: boolean;
  /** Heading size */
  size?: "lg" | "md";
}

/**
 * Marketing section heading — eyebrow + large Cormorant Garamond serif
 * headline, with an optional italic olive emphasis phrase appended.
 * The core typographic pattern of btinvestments.co sections.
 */
export function SectionHeading({
  eyebrow,
  children,
  emphasis,
  onDark = false,
  size = "lg",
}: SectionHeadingProps) {
  return (
    <div>
      {eyebrow && <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>}
      <h2
        style={{
          fontFamily: "var(--bt-font-display)",
          fontWeight: 500,
          fontSize: size === "lg" ? "3rem" : "2.1rem",
          lineHeight: 1.08,
          letterSpacing: "-0.01em",
          color: onDark ? "var(--bt-ink-on-dark)" : "var(--bt-ink)",
          marginTop: eyebrow ? "1.25rem" : 0,
          marginBottom: 0,
        }}
      >
        {children}
        {emphasis && (
          <>
            {" "}
            <em
              style={{
                fontStyle: "italic",
                color: onDark ? "var(--bt-olive-pale)" : "var(--bt-olive)",
              }}
            >
              {emphasis}
            </em>
          </>
        )}
      </h2>
    </div>
  );
}
