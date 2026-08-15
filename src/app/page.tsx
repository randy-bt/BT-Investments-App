import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { YourOptionsSection } from "@/components/marketing/YourOptionsSection";
import { WhyUsSection } from "@/components/marketing/WhyUsSection";
import { FooterSection } from "@/components/marketing/FooterSection";

export const metadata: Metadata = {
  // Home keeps the bare brand title (no template suffix doubling the name).
  title: { absolute: "BT Investments" },
  description:
    "Sell your Washington house for cash. BT Investments makes fair offers with no repairs, no fees, no commissions, and a closing date you choose.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <HeroSection />
      <HowItWorksSection />
      <YourOptionsSection />
      <WhyUsSection />
      <FooterSection />
    </div>
  );
}
