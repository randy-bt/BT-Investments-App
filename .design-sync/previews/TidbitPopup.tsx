import React from "react";
import { TidbitPopup } from "bt-investments";

export const WithTail = () => (
  <div style={{ background: "#ffffff", padding: "32px 32px 48px" }}>
    <TidbitPopup>Close in 7 days or 6 months. Your call.</TidbitPopup>
  </div>
);

export const NoTail = () => (
  <div style={{ background: "#f0eee5", padding: 32 }}>
    <TidbitPopup tail={false}>
      Fire damage, hoarder situations, even full tear downs. We&apos;ve seen it all.
    </TidbitPopup>
  </div>
);
