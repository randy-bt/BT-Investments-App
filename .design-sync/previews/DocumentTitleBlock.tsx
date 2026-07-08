import React from "react";
import { DocumentTitleBlock } from "bt-investments";

export const Agreement = () => (
  <div style={{ background: "#ffffff", padding: 40, maxWidth: 640 }}>
    <DocumentTitleBlock
      title="Purchase & Sale Agreement"
      meta="Effective July 8, 2026 · Ref V2"
    />
  </div>
);

export const Report = () => (
  <div style={{ background: "#ffffff", padding: 40, maxWidth: 640 }}>
    <DocumentTitleBlock title="Deal Summary" kicker="BT Investments · Confidential" />
  </div>
);
