import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Sell Your Property | BT Investments",
};

export default function SellPropertyPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="sellForm" />
    </HelloShell>
  );
}
