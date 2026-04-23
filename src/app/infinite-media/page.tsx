import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Infinite Media",
};

export default function InfiniteMediaPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="services" />
    </HelloShell>
  );
}
