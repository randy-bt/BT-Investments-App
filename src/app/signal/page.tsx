import type { Metadata } from "next";
import SignalIntake from "@/components/signal/SignalIntake";

// The Signal front door (handoff 001): the intake experience replaced the
// waitlist on 2026-07-10. The waitlist component (HelloClient's
// signalWaitlist screen) stays in the repo but is no longer routed here —
// Randy may resurface it someday.

export const metadata: Metadata = {
  title: "Signal",
  description: "Custom AI tools, built for your business.",
};

export default function SignalPage() {
  return <SignalIntake />;
}
