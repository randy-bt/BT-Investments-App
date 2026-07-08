import React from "react";
import { BTWordmark } from "bt-investments";

export const HeroWithTagline = () => (
  <div style={{ background: "#ffffff", padding: 48 }}>
    <BTWordmark size="hero" tagline />
  </div>
);

export const HeaderSize = () => (
  <div style={{ background: "#ffffff", padding: 32 }}>
    <BTWordmark size="header" />
  </div>
);

export const OnDark = () => (
  <div style={{ background: "#161614", padding: 32 }}>
    <BTWordmark size="header" onDark />
  </div>
);

export const FooterMark = () => (
  <div style={{ background: "#f0eee5", padding: 24 }}>
    <BTWordmark size="footer" />
  </div>
);
