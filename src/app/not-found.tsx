import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { FooterBody } from "@/components/marketing/FooterSection";

// Root not-found (audit 001; the item Randy flagged personally). Replaces
// the stock "404: This page could not be found." with the marketing
// shell, so a dead link lands somewhere that still looks like us and
// offers a way onward. Serves both hosts; most 404s are public URLs, so
// it wears the public site's clothes.
export default function NotFound() {
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
            404
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
            This page doesn&apos;t exist.
          </h1>
          <p
            className="font-mkt-sans mt-5 max-w-xl mx-auto"
            style={{
              color: "var(--mkt-muted-light)",
              fontSize: "1rem",
              lineHeight: 1.55,
            }}
          >
            The link may be old, or the page may have moved. Everything we
            do is a click away below.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              Home
            </Link>
            <span style={{ color: "var(--mkt-muted-light)" }}>·</span>
            <Link
              href="/sell-property"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              Get a cash offer
            </Link>
            <span style={{ color: "var(--mkt-muted-light)" }}>·</span>
            <Link
              href="/faq"
              className="font-mkt-sans text-sm underline underline-offset-4"
              style={{ color: "var(--mkt-olive)" }}
            >
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
