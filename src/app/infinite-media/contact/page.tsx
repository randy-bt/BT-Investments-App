import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Infinite Media — Contact",
};

export default function InfiniteMediaContactPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="contact" standalone />
    </HelloShell>
  );
}
