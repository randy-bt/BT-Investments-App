import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";

export const metadata: Metadata = {
  title: "Hello",
  description: "BT Investments: companies, services, and ways to connect.",
  alternates: { canonical: "/hello" },
};

export default function HelloLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HelloShell>{children}</HelloShell>;
}
