import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { BuyersListForm } from "@/components/marketing/BuyersListForm";
import {
  MarketingPageHero,
  FadeUpOnView,
} from "@/components/marketing/MarketingPageHero";
import { FooterBody } from "@/components/marketing/FooterSection";

export const metadata: Metadata = {
  title: "Join Our Buyers List | BT Investments",
};

export default function JoinBuyersListPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      <MarketingPageHero
        eyebrow="For Investors"
        headlineLead="Get first access to"
        headlineEm="off-market deals."
        emOnNewLine
        body="Tell us what you're looking for and we'll start sending wholesale, creative-finance, and fixer-upper opportunities that match your criteria."
      />

      {/* Form — Suspense boundary required because BuyersListForm uses
          useSearchParams (Next.js requires it for static optimization).
          FadeUpOnView reveals it as the user scrolls in. */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pb-16 sm:pb-20">
          <FadeUpOnView>
            <Suspense fallback={null}>
              <BuyersListForm />
            </Suspense>
          </FadeUpOnView>
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
