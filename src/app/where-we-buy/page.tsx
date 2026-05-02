import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { WashingtonMap } from "@/components/marketing/WashingtonMap";
import { CTA1Inline } from "@/components/marketing/CTA1Inline";
import { FooterBody } from "@/components/marketing/FooterSection";

export default function WhereWeBuyPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      {/* Header — eyebrow + title + subhead */}
      <section
        className="w-full"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-28 sm:pt-32 pb-8 sm:pb-12">
          <div
            className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
            style={{ color: "var(--mkt-olive)" }}
          >
            Where We Buy
          </div>
          <h1
            className="font-mkt-display mt-5 sm:mt-6"
            style={{
              fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
              color: "var(--mkt-text-on-light)",
            }}
          >
            Local homes,{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "#8a9550", fontStyle: "italic" }}
            >
              on your terms.
            </em>
          </h1>
          <p
            className="font-mkt-sans mt-6 max-w-2xl text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-light)",
              lineHeight: 1.55,
            }}
          >
            We buy houses across Western Washington — Seattle, Bellevue,
            Kirkland, and surrounding communities. If your property is in
            the area, we&apos;d love to make you an offer.
          </p>
        </div>
      </section>

      {/* Map */}
      <section
        className="w-full"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pb-10 sm:pb-12">
          <WashingtonMap />
          <p
            className="font-mkt-sans mt-6 text-center text-sm"
            style={{ color: "var(--mkt-muted-light)" }}
          >
            Hover a marker to see the city. Larger markers indicate our two
            primary service areas.
          </p>
        </div>
      </section>

      {/* CTA1 — bottom-of-page conversion card */}
      <CTA1Inline
        eyebrow="Don't see your area?"
        title={
          <>
            We may{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "var(--mkt-olive-light)", fontStyle: "italic" }}
            >
              still
            </em>{" "}
            buy your home.
          </>
        }
        body="Even if your city isn't on the map, send us your address. If it's anywhere in Washington (or nearby), there's a good chance we can make you a fair, no-obligation offer."
      />

      <FooterBody />
    </div>
  );
}
