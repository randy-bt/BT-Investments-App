import { PageBranding } from "./PageBranding";

/**
 * FixedBrandingHeader — sticks the BT Investments wordmark to the
 * top-left of the viewport on inner marketing pages so the user can
 * always click back to home, no matter how far they've scrolled.
 *
 * The bulge from MarketingNav sits at z-40 — this header at z-30 stays
 * below it so the bulge can slide in front if any visual overlap ever
 * occurs at the top-right.
 *
 * Previously had a soft cream-to-transparent backdrop band for
 * readability when content scrolled under the wordmark, but with
 * --mkt-cream now resolving to pure white the backdrop became
 * white-on-white — invisible at best, visible-as-an-artifact-band at
 * worst on iPad Safari (sRGB alpha interpolation). Removed; the
 * wordmark sits directly on the white page background.
 */
export function FixedBrandingHeader() {
  return (
    <div className="fixed top-6 left-6 sm:top-8 sm:left-10 z-30">
      <PageBranding />
    </div>
  );
}
