import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: { absolute: "Menu | Infinite Media" },
  description: "Infinite Media services and offerings.",
  alternates: { canonical: "/infinite-media/menu" },
};

export default function InfiniteMediaMenuPage() {
  return (
    <HelloShell>
      <h1 className="sr-only">Infinite Media Menu</h1>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="menu" standalone />
    </HelloShell>
  );
}
