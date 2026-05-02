import type { Metadata } from "next";
import HelloShell from "@/components/HelloShell";
import HelloClient from "@/app/hello/HelloClient";

export const metadata: Metadata = {
  title: "Signal | BT Investments",
};

export default function SignalPage() {
  return (
    <HelloShell>
      <HelloClient initialScreen="signalWaitlist" standalone />
    </HelloShell>
  );
}
