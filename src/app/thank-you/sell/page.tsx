import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { FooterBody } from "@/components/marketing/FooterSection";

// The seller form redirects here on success (audit 001). A dedicated page
// instead of the old inline confirmation for one load-bearing reason: a
// URL change is the conversion event. Vercel Analytics counts a pageview
// of /thank-you/sell; the inline swap produced nothing to count.
export const metadata: Metadata = {
  title: "Thank You",
  description: "We received your property details.",
  // A confirmation has no business in search results.
  robots: { index: false, follow: false },
};

export default function SellThankYouPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      <section
        className="w-full min-h-[70vh] flex items-center"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-3xl px-6 sm:px-10 py-24 text-center">
          <div
            className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
            style={{ color: "var(--mkt-olive)" }}
          >
            Submitted
          </div>
          <h1
            className="font-mkt-display mt-4"
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.1,
              fontWeight: 700,
              color: "var(--mkt-text-on-light)",
            }}
          >
            Thank you. We&apos;ll be in touch within 24 hours.
          </h1>
          <p
            className="font-mkt-sans mt-5 max-w-xl mx-auto"
            style={{
              color: "var(--mkt-muted-light)",
              fontSize: "1rem",
              lineHeight: 1.55,
            }}
          >
            We&apos;ll review the details you shared, run our analysis, and
            reach out by phone or email with a no-obligation cash offer. If
            you have photos handy, reply to our follow-up email with them.
            They help us tighten the offer.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/faq"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              What happens next
            </Link>
            <span style={{ color: "var(--mkt-muted-light)" }}>·</span>
            <Link
              href="/"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
