import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Join Our Buyers List | BT Investments",
};

export default function JoinBuyersListPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="form" />
    </HelloShell>
  );
}
