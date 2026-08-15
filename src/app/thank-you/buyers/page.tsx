import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { FooterBody } from "@/components/marketing/FooterSection";

// Buyers-list twin of /thank-you/sell - see that file for why this is a
// page and not an inline swap. Separate path on purpose: seller leads and
// buyer signups are different conversions, and analytics tells them apart
// by pathname.
export const metadata: Metadata = {
  title: "You're On The List",
  description: "Welcome to the BT Investments buyers list.",
  robots: { index: false, follow: false },
};

export default function BuyersThankYouPage() {
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
            You&apos;re on the list
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
            Welcome to the buyers list.
          </h1>
          <p
            className="font-mkt-sans mt-5 max-w-xl mx-auto"
            style={{
              color: "var(--mkt-muted-light)",
              fontSize: "1rem",
              lineHeight: 1.55,
            }}
          >
            We&apos;ll start sending deals that match your criteria. If we
            have something that fits before our next batch, expect an email
            or call from us shortly.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/where-we-buy"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              Where we buy
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
