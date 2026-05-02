import Link from "next/link";

/**
 * PageBranding — small "BT INVESTMENTS" wordmark for the top of inner
 * marketing pages (where the homepage's giant hero wordmark isn't
 * present). Clickable, links to /. Hovers to slight transparency.
 *
 * Visually matches the homepage hero's wordmark scaled way down:
 *   - "BT" in Cormorant serif
 *   - "Investments" in Inter caps with wide tracking, olive
 */
export function PageBranding() {
  return (
    <Link
      href="/"
      className="inline-block group transition-opacity hover:opacity-80"
      aria-label="BT Investments — back to home"
    >
      <div
        className="font-mkt-display leading-none tracking-tight"
        style={{
          fontSize: "clamp(1.5rem, 2.4vw, 2.1rem)",
          fontWeight: 500,
          color: "var(--mkt-text-on-light)",
        }}
      >
        BT
      </div>
      <div
        className="font-mkt-sans uppercase mt-1 tracking-[0.32em]"
        style={{
          color: "#76794c",
          fontSize: "clamp(0.6rem, 0.8vw, 0.75rem)",
          fontWeight: 500,
        }}
      >
        Investments
      </div>
    </Link>
  );
}
