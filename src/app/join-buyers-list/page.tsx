import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { BuyersListForm } from "@/components/marketing/BuyersListForm";
import { FooterBody } from "@/components/marketing/FooterSection";

export const metadata: Metadata = {
  title: "Join Our Buyers List | BT Investments",
};

export default function JoinBuyersListPage() {
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
            For Investors
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
            Get first access to{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "#8a9550", fontStyle: "italic" }}
            >
              off-market deals.
            </em>
          </h1>
          <p
            className="font-mkt-sans mt-6 max-w-2xl text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-light)",
              lineHeight: 1.55,
            }}
          >
            Tell us what you&apos;re looking for and we&apos;ll start sending
            wholesale, creative-finance, and fixer-upper opportunities that
            match your criteria. No spam — just deals.
          </p>
        </div>
      </section>

      {/* Form — Suspense boundary required because BuyersListForm uses
          useSearchParams (Next.js requires it for the static optimization). */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pb-16 sm:pb-20">
          <Suspense fallback={null}>
            <BuyersListForm />
          </Suspense>
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
