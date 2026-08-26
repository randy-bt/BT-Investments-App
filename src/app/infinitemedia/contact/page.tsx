import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: { absolute: "Contact | Infinite Media" },
  description: "Get in touch with Infinite Media.",
  alternates: { canonical: "/infinitemedia/contact" },
};

export default function InfiniteMediaContactPage() {
  return (
    <HelloShell>
      <h1 className="sr-only">Contact Infinite Media</h1>
      <HelloClient initialScreen="infiniteMedia" initialInfiniteTab="contact" standalone />
    </HelloShell>
  );
}
