import { PageBranding } from "./PageBranding";

/**
 * FixedBrandingHeader — sticks the BT Investments wordmark to the
 * top-left of the viewport on inner marketing pages so the user can
 * always click back to home, no matter how far they've scrolled.
 *
 * A subtle cream-to-transparent gradient sits behind it (z below the
 * branding but above page content) so the wordmark stays readable when
 * page content scrolls underneath without needing a hard divider line.
 *
 * The bulge from MarketingNav sits at z-40 — this header at z-30 stays
 * below it so the bulge can slide in front if any visual overlap ever
 * occurs at the top-right.
 */
export function FixedBrandingHeader() {
  return (
    <>
      {/* Soft cream-to-transparent backdrop band — fades content into
          readability under the wordmark without acting as a hard nav bar */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-20 sm:h-24 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, var(--mkt-cream) 40%, rgba(255,255,255,0))",
        }}
      />
      {/* The branding itself — clickable, links home */}
      <div className="fixed top-6 left-6 sm:top-8 sm:left-10 z-30">
        <PageBranding />
      </div>
    </>
  );
}
