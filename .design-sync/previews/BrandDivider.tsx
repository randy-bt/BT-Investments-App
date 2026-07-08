import React from "react";
import { BrandDivider } from "bt-investments";

export const Plain = () => (
  <div style={{ background: "#ffffff", padding: 24 }}>
    <BrandDivider />
  </div>
);

export const WithDiamond = () => (
  <div style={{ background: "#ffffff", padding: 24 }}>
    <BrandDivider diamond />
  </div>
);

export const OnDarkFullWidth = () => (
  <div style={{ background: "#161614", padding: 24 }}>
    <BrandDivider onDark diamond width="100%" />
  </div>
);
