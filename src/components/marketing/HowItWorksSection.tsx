/**
 * How It Works
 *
 * Dark near-black background. Editorial serif headline with one phrase
 * italicized + olive ("handed-keys"). Right column intro paragraph.
 *
 * Desktop: 4 numbered columns with thin vertical dividers between.
 * Mobile:  4 stacked rows (number left, title + short desc right) — all
 *          four visible on one phone screen, no scroll within the steps.
 */

const STEPS = [
  {
    n: "01",
    title: "Tell us about your home",
    desktop:
      "Share your address and a few details. It takes less than a minute — no obligation.",
    mobile: "Share your address. Less than a minute. No obligation.",
  },
  {
    n: "02",
    title: "Get a tailored proposal",
    desktop:
      "We analyze your property and present all three options so you can compare side by side.",
    mobile: "We analyze your home and present all three options.",
  },
  {
    n: "03",
    title: "Pick your path",
    desktop:
      "Cash, creative, or list — choose the route and the timeline that fits your life.",
    mobile: "Cash, creative, or list — your timeline.",
  },
  {
    n: "04",
    title: "Close & get paid",
    desktop:
      "We handle paperwork, title, and escrow. You walk away with funds in the bank.",
    mobile: "We handle paperwork. You walk away paid.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      className="w-full"
      style={{
        background: "var(--mkt-dark)",
        color: "var(--mkt-text-on-dark)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 py-20 sm:py-28">
        {/* Eyebrow */}
        <div
          className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
          style={{ color: "var(--mkt-olive)" }}
        >
          How It Works
        </div>

        {/* Headline + intro paragraph: stacked on mobile, side-by-side on desktop.
            Headline force-breaks to 3 lines via block spans. On desktop the
            two columns are bottom-aligned (lg:items-end) so the paragraph's
            last line stays locked to "days, not months." — alignment holds
            regardless of viewport width since the paragraph rides up/down
            with the headline's height. */}
        <div className="mt-2 sm:mt-3 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 lg:items-end">
          <h2
            className="lg:col-span-7 font-mkt-display"
            style={{
              fontSize: "clamp(2.925rem, 5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
            }}
          >
            <span className="block">From hello to</span>
            <span className="block">
              <em
                className="font-mkt-display italic"
                style={{ color: "#8a9550", fontStyle: "italic" }}
              >
                handed-keys
              </em>{" "}
              in
            </span>
            <span className="block">days, not months.</span>
          </h2>
          <p
            className="lg:col-span-5 font-mkt-sans text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-dark)",
              lineHeight: 1.55,
            }}
          >
            We&apos;ve simplified the messy parts of selling — paperwork,
            repairs, negotiating, waiting. You get clarity, control, and a
            closing date you actually choose.
          </p>
        </div>

        {/* Tablet + Desktop: 4 columns with thin vertical dividers.
            Activated at md+ so tablet stays horizontal (mobile-only gets
            the stacked vertical layout). */}
        <div className="hidden md:grid mt-20 grid-cols-4 gap-0">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="px-3 lg:px-6"
              style={{
                borderLeft:
                  i === 0 ? "none" : "1px solid rgba(245,239,226,0.12)",
              }}
            >
              <div
                className="font-mkt-display"
                style={{
                  color: "#8a9550",
                  fontSize: "clamp(2.25rem, 3.5vw, 3.5rem)",
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                {s.n}
              </div>
              <h3
                className="font-mkt-display mt-6 lg:mt-10 whitespace-nowrap"
                style={{
                  // Smallest tablet width (~688 content / 4 cols ≈ 170 each
                  // minus padding) needs the title to be small enough to
                  // fit on one line. clamp scales between mobile/tablet
                  // and desktop sizes.
                  fontSize: "clamp(0.85rem, 1.5vw, 1.5rem)",
                  fontWeight: 500,
                }}
              >
                {s.title}
              </h3>
              <p
                className="font-mkt-sans mt-3 text-xs lg:text-sm"
                style={{
                  color: "var(--mkt-muted-dark)",
                  lineHeight: 1.6,
                }}
              >
                {s.desktop}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile only: 4 stacked compact rows — all four visible on one screen */}
        <div className="md:hidden mt-10 space-y-5">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-4 items-start">
              <div
                className="font-mkt-display shrink-0"
                style={{
                  color: "#8a9550",
                  fontSize: "2.5rem",
                  lineHeight: 1,
                  fontWeight: 400,
                  width: "3.5rem",
                }}
              >
                {s.n}
              </div>
              <div className="flex-1 pt-1">
                <h3
                  className="font-mkt-display"
                  style={{ fontSize: "1.25rem", fontWeight: 500 }}
                >
                  {s.title}
                </h3>
                <p
                  className="font-mkt-sans mt-1 text-sm"
                  style={{
                    color: "var(--mkt-muted-dark)",
                    lineHeight: 1.5,
                  }}
                >
                  {s.mobile}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
