import React from "react";
import { StatNumber } from "bt-investments";

export const OnDarkRow = () => (
  <div style={{ background: "#161614", padding: 40, display: "flex", gap: 56 }}>
    <StatNumber value="120+" label="Homes Purchased" />
    <StatNumber value="7" label="Day Fastest Close" />
    <StatNumber value="$0" label="Fees To Sellers" />
  </div>
);

export const OnLight = () => (
  <div style={{ background: "#ffffff", padding: 40 }}>
    <StatNumber value="15" label="Counties Served" onDark={false} />
  </div>
);
