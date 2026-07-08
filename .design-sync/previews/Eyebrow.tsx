import React from "react";
import { Eyebrow } from "bt-investments";

export const OnLight = () => (
  <div style={{ background: "#ffffff", padding: 24 }}>
    <Eyebrow>Why Homeowners Choose Us</Eyebrow>
  </div>
);

export const OnDark = () => (
  <div style={{ background: "#161614", padding: 24 }}>
    <Eyebrow onDark>How It Works</Eyebrow>
  </div>
);
