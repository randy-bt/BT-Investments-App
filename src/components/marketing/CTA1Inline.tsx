import Link from "next/link";

/**
 * CTA1Inline — bottom-of-page CTA card used on inner pages
 * (/where-we-buy, /faq) so the primary "Get a cash offer" path is
 * always visible without dedicating a full section to it.
 *
 * Sits on cream background, has a dark inner card matching the
 * visual treatment of the homepage's CTA2 section.
 */
export function CTA1Inline({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
}) {
  return (
    <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
      <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-2 sm:pt-4 pb-4 sm:pb-6">
        <div
          className="rounded-2xl p-6 sm:p-10 lg:p-12 flex flex-col md:flex-row md:items-center gap-5 md:gap-10"
          style={{
            background: "var(--mkt-dark)",
            color: "var(--mkt-text-on-dark)",
            border: "1px solid rgba(245,239,226,0.08)",
          }}
        >
          <div className="flex-1">
            <div
              className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
              style={{ color: "var(--mkt-olive)" }}
            >
              {eyebrow}
            </div>
            <h2
              className="font-mkt-display mt-3"
              style={{
                // Mobile floor reduced from 1.75rem → 1.4rem so the CTA
                // card is shorter on phone widths. Tablet/desktop sizes
                // unchanged (handled by the vw component + max).
                fontSize: "clamp(1.4rem, 3.2vw, 2.75rem)",
                lineHeight: 1.1,
                fontWeight: 500,
                color: "var(--mkt-text-on-dark)",
              }}
            >
              {title}
            </h2>
            <p
              className="font-mkt-sans mt-3 sm:mt-4 max-w-xl text-[0.85rem] sm:text-[0.95rem]"
              style={{
                color: "var(--mkt-muted-dark)",
                lineHeight: 1.55,
              }}
            >
              {body}
            </p>
          </div>
          <Link
            href="/sell-property"
            className="font-mkt-sans inline-flex items-center justify-center rounded-full px-8 py-4 transition-opacity hover:opacity-90 shrink-0"
            style={{
              background: "var(--mkt-olive)",
              color: "var(--mkt-cream)",
              fontWeight: 500,
              fontSize: "0.95rem",
            }}
          >
            Get a Cash Offer &nbsp;&rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
