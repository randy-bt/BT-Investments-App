import type { Metadata } from "next";

// The page is a client component; its metadata lives here (same pattern as
// /faq). Audit 001: this page shared the parent layout's title.
export const metadata: Metadata = {
  title: { absolute: "Contact | Infinite RE" },
  description: "Book Infinite RE for luxury real estate photography, video, and brand content.",
  alternates: { canonical: "/infinite-re/contact" },
};

export default function InfiniteReContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
