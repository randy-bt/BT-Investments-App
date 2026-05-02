import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { SellPropertyForm } from "@/components/marketing/SellPropertyForm";
import { FooterBody } from "@/components/marketing/FooterSection";

export const metadata: Metadata = {
  title: "Get a Cash Offer | BT Investments",
};

export default function SellPropertyPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      {/* Header — eyebrow + title + subhead */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pt-28 sm:pt-32 pb-8 sm:pb-12">
          <div
            className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
            style={{ color: "var(--mkt-olive)" }}
          >
            Get a Cash Offer
          </div>
          <h1
            className="font-mkt-display mt-5 sm:mt-6"
            style={{
              fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
              color: "var(--mkt-text-on-light)",
            }}
          >
            Tell us about your property —{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "#8a9550", fontStyle: "italic" }}
            >
              we&apos;ll do the rest.
            </em>
          </h1>
          <p
            className="font-mkt-sans mt-6 max-w-2xl text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-light)",
              lineHeight: 1.55,
            }}
          >
            Three short steps. We&apos;ll review the details you share and come
            back with a no-obligation cash offer within 24 hours. Photos
            aren&apos;t required up front — we&apos;ll request them by email
            after the initial review.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pb-16 sm:pb-20">
          <SellPropertyForm />
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
