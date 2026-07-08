import React from "react";
import { LetterheadHeader } from "bt-investments";

export const Default = () => (
  <div style={{ background: "#ffffff", padding: 32, maxWidth: 720 }}>
    <LetterheadHeader />
  </div>
);

export const CustomContact = () => (
  <div style={{ background: "#ffffff", padding: 32, maxWidth: 720 }}>
    <LetterheadHeader
      contactLines={["BT Investments", "randy@btinvestments.co", "(402) 317-7748", "btinvestments.co"]}
    />
  </div>
);
