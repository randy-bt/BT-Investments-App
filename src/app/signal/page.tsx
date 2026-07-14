import type { Metadata } from "next";
import SignalIntake from "@/components/signal/SignalIntake";
import SignalUniverse from "@/components/signal/SignalUniverse";
import MetaPixel from "@/components/signal/MetaPixel";

// The Signal front door: the intake experience (handoff 001) plus the
// universe (handoff 002). DOM order mirrors the reference file
// (SIGNAL/design/signal-universe.html): intro ritual, landing (the real
// composer + the gate), seed dot, then the world + dots inside
// SignalUniverse, which also runs the canvas engine over all of it.
// The old Signal waitlist was fully removed with handoff 006 (it last
// lived as an embedded screen inside /hello's HelloClient).

// SEO + share hygiene per handoff 003: copy is word for word, no pricing
// figures, no em-dashes. The share card lives in /public (1200x630).
const TITLE = "Signal, Custom AI tools built for your business";
const DESCRIPTION =
  "Tell us what your business needs in a text, a voice note, or photos. We send back the solution, the tool, and the price.";
const SHARE_CARD = "https://btinvestments.co/signal-share-card.png";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://btinvestments.co/signal" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://btinvestments.co/signal",
    siteName: "Signal",
    type: "website",
    images: [{ url: SHARE_CARD, width: 1200, height: 630, alt: "Signal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_CARD],
  },
};

export default function SignalPage() {
  return (
    <div className="sig-page">
      <MetaPixel />
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
