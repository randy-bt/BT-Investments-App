import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Infinite Media — Portfolio",
};

export default function InfiniteMediaPortfolioPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="portfolio" />
    </HelloShell>
  );
}
