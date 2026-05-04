import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Infinite Media — Menu",
};

export default function InfiniteMediaMenuPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="menu" standalone />
    </HelloShell>
  );
}
