import React from "react";
import { AnnotationCallout } from "bt-investments";

export const Single = () => (
  <div style={{ background: "#ffffff", padding: 32 }}>
    <AnnotationCallout label="Any Condition" />
  </div>
);

export const Row = () => (
  <div style={{ background: "#f0eee5", padding: 32, display: "flex", gap: 64 }}>
    <AnnotationCallout label="Flexible Terms" lineLength={60} />
    <AnnotationCallout label="Your Timeline" lineLength={110} />
  </div>
);
