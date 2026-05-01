import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { YourOptionsSection } from "@/components/marketing/YourOptionsSection";
import { WhyUsSection } from "@/components/marketing/WhyUsSection";
import { FooterSection } from "@/components/marketing/FooterSection";

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
