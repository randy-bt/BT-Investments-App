import React from "react";
import { SectionHeading } from "bt-investments";

export const WithEmphasis = () => (
  <div style={{ background: "#ffffff", padding: 32, maxWidth: 640 }}>
    <SectionHeading eyebrow="Why Homeowners Choose Us" emphasis="on your terms.">
      Sell your house
    </SectionHeading>
  </div>
);

export const OnDark = () => (
  <div style={{ background: "#161614", padding: 32, maxWidth: 640 }}>
    <SectionHeading eyebrow="How It Works" emphasis="start to finish." onDark>
      Three simple steps,
    </SectionHeading>
  </div>
);

export const MediumNoEyebrow = () => (
  <div style={{ background: "#f0eee5", padding: 32, maxWidth: 560 }}>
    <SectionHeading size="md">Frequently asked questions</SectionHeading>
  </div>
);
