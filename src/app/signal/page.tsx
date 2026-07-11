import type { Metadata } from "next";
import SignalIntake from "@/components/signal/SignalIntake";
import SignalUniverse from "@/components/signal/SignalUniverse";

// The Signal front door: the intake experience (handoff 001) plus the
// universe (handoff 002). DOM order mirrors the reference file
// (SIGNAL/design/signal-universe.html): intro ritual, landing (the real
// composer + the gate), seed dot, then the world + dots inside
// SignalUniverse, which also runs the canvas engine over all of it.
// The waitlist component (HelloClient's signalWaitlist screen) stays in
// the repo but is no longer routed here — Randy may resurface it someday.

export const metadata: Metadata = {
  title: "Signal",
  description: "Custom AI tools, built for your business.",
};

export default function SignalPage() {
  return (
    <div className="sig-page">
      <div id="sig-intro" aria-hidden="true">
        <span className="idot" />
        <div className="iword">SIGNAL</div>
      </div>

      <div id="sig-landing">
        <SignalIntake />
        <button className="sig-gate sig-rise sig-r5" id="sig-gate" type="button">
          <span className="lbl">See what we can build for you</span>
          <span className="arr">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v16M5 13l7 7 7-7" />
            </svg>
          </span>
        </button>
      </div>

      <div id="sig-seed" />

      <SignalUniverse />
    </div>
  );
}
