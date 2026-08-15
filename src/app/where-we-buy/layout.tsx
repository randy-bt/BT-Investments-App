import type { Metadata } from "next";

// Metadata for the client-component page below it (see faq/layout.tsx for
// the pattern and audit 001 for why).
export const metadata: Metadata = {
  title: "Where We Buy",
  description:
    "The Washington cities and neighborhoods where BT Investments buys houses for cash, from the Puget Sound corridor outward.",
  alternates: { canonical: "/where-we-buy" },
};

export default function WhereWeBuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
