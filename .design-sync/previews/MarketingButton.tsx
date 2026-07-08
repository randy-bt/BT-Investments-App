import React from "react";
import { MarketingButton } from "bt-investments";

export const Primary = () => (
  <div style={{ background: "#ffffff", padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
    <MarketingButton>Get My Cash Offer</MarketingButton>
    <MarketingButton size="lg">Get My Cash Offer</MarketingButton>
  </div>
);

export const OnDarkSection = () => (
  <div style={{ background: "#161614", padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
    <MarketingButton variant="onDark">See Our Deals</MarketingButton>
    <MarketingButton variant="onDark" size="lg">See Our Deals</MarketingButton>
  </div>
);

export const Ghost = () => (
  <div style={{ background: "#f0eee5", padding: 24, display: "flex", gap: 16, alignItems: "center" }}>
    <MarketingButton variant="ghost">Learn More</MarketingButton>
    <MarketingButton variant="ghost" disabled>Unavailable</MarketingButton>
  </div>
);
