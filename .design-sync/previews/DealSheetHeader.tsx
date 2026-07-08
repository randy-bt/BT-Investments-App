import React from "react";
import { DealSheetHeader } from "bt-investments";

export const FullDetails = () => (
  <div style={{ background: "#ffffff", padding: 32, maxWidth: 640 }}>
    <DealSheetHeader
      address="1215 21st St SE"
      cityState="Auburn, WA 98002"
      price="$560,000"
      stats={[
        { label: "Beds", value: "4" },
        { label: "Baths", value: "2.5" },
        { label: "Sqft", value: "2,140" },
        { label: "Lot", value: "7,200 sqft" },
      ]}
    />
  </div>
);

export const Minimal = () => (
  <div style={{ background: "#ffffff", padding: 32, maxWidth: 640 }}>
    <DealSheetHeader address="29833 4th Ave SW" cityState="Federal Way, WA" price="$656,000" />
  </div>
);
