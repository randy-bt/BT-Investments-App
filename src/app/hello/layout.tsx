import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";

export const metadata: Metadata = {
  title: "Hello | BT Investments",
  description: "BT Investments — companies, services, and ways to connect.",
};

export default function HelloLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HelloShell>{children}</HelloShell>;
}
