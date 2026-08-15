import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: { absolute: "Portfolio | Infinite Media" },
  description: "Selected work from Infinite Media.",
  alternates: { canonical: "/infinite-media/portfolio" },
};

export default function InfiniteMediaPortfolioPage() {
  return (
    <HelloShell>
      <h1 className="sr-only">Infinite Media Portfolio</h1>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="portfolio" />
    </HelloShell>
  );
}
