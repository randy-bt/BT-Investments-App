import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: { absolute: "Infinite Media" },
  description: "Infinite Media: content, media production, and creative services.",
  alternates: { canonical: "/infinitemedia" },
};

export default function InfiniteMediaPage() {
  return (
    <HelloShell>
      <h1 className="sr-only">Infinite Media</h1>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="home" standalone />
    </HelloShell>
  );
}
