import React from "react";
import { MarketingSection, SectionHeading, MarketingButton, Eyebrow } from "bt-investments";

export const CreamSection = () => (
  <MarketingSection tone="cream">
    <SectionHeading eyebrow="Our Promise" emphasis="every single time.">
      Fair offers,
    </SectionHeading>
    <div style={{ marginTop: 24 }}>
      <MarketingButton>Get My Cash Offer</MarketingButton>
    </div>
  </MarketingSection>
);

export const DarkSection = () => (
  <MarketingSection tone="dark">
    <SectionHeading eyebrow="See The Numbers" emphasis="speaks for itself." onDark>
      Our track record
    </SectionHeading>
    <div style={{ marginTop: 24 }}>
      <MarketingButton variant="onDark">See Our Deals</MarketingButton>
    </div>
  </MarketingSection>
);

export const CreamDim = () => (
  <MarketingSection tone="creamDim" pad="normal">
    <Eyebrow>Where We Buy</Eyebrow>
  </MarketingSection>
);
