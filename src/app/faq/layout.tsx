import type { Metadata } from "next";

// The page itself is a client component ("use client" for the accordion
// animations), so its metadata lives here. Audit 001: this page shared the
// root title and description with 8 others.
export const metadata: Metadata = {
  title: "FAQ",
  description:
    "The questions sellers ask us most: how the cash offer works, how fast we close, what we buy, and what it costs you (nothing).",
  alternates: { canonical: "/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
