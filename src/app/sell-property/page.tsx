import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { SellPropertyForm } from "@/components/marketing/SellPropertyForm";
import {
  MarketingPageHero,
  FadeUpOnView,
} from "@/components/marketing/MarketingPageHero";
import { FooterBody } from "@/components/marketing/FooterSection";

export const metadata: Metadata = {
  title: "Get a Cash Offer | BT Investments",
};

export default function SellPropertyPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      <MarketingPageHero
        eyebrow="Get a Cash Offer"
        headlineLead="Tell us about your home."
        headlineEm="We'll handle the rest."
        emOnNewLine
        body="The more you tell us, the more accurate (and often higher) our offer."
      />

      {/* Form — fades up as the user scrolls into it */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pb-16 sm:pb-20">
          <FadeUpOnView>
            <SellPropertyForm />
          </FadeUpOnView>
        </div>
      </section>

      <FooterBody />
    </div>
  );
}
