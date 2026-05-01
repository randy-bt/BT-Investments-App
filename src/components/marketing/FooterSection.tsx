import Link from "next/link";

/**
 * Footer + CTA2
 *
 * Two visually-distinct sections:
 *   1. CTA2 (top): white background, with a dark inner card containing
 *      the investor signup form. Side-by-side text + form on tablet+.
 *   2. Footer body (bottom): dark background. 3-column footer + legal row.
 */

const SELL_LINKS = [
  { label: "Cash Offer", href: "/sell-property" },
  { label: "Creative Financing", href: "/sell-property" },
  { label: "On-Market Listing", href: "/sell-property" },
  { label: "Our Process", href: "/" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/" },
  { label: "Contact", href: "/" },
  { label: "(206) 555-0142", href: "tel:+12065550142" },
  { label: "hello@btinvestments.co", href: "mailto:hello@btinvestments.co" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/" },
  { label: "Terms", href: "/" },
  { label: "Disclosures", href: "/" },
];

export function FooterSection() {
  return (
    <>
      {/* CTA2 — white background; dark card sits inside */}
      <section
        className="w-full"
        style={{ background: "var(--mkt-cream)" }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-2 sm:pt-4 pb-6 sm:pb-8">
          <div
            className="rounded-2xl p-7 sm:p-10 lg:p-12"
            style={{
              background: "var(--mkt-dark)",
              color: "var(--mkt-text-on-dark)",
              border: "1px solid rgba(245,239,226,0.08)",
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 lg:gap-14 items-start">
              {/* LEFT — eyebrow + headline + subhead */}
              <div className="md:col-span-6">
                <div
                  className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
                  style={{ color: "var(--mkt-olive)" }}
                >
                  For Investors
                </div>

                {/* Serif headline with italic-olive on "buy" */}
                <h2
                  className="font-mkt-display mt-5"
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 3.75rem)",
                    lineHeight: 1.05,
                    fontWeight: 500,
                    color: "var(--mkt-text-on-dark)",
                  }}
                >
                  Looking to{" "}
                  <em
                    className="font-mkt-display italic"
                    style={{
                      color: "var(--mkt-olive-light)",
                      fontStyle: "italic",
                      fontWeight: 600,
                    }}
                  >
                    buy
                  </em>{" "}
                  instead?
                </h2>

                <p
                  className="font-mkt-sans mt-6 max-w-md"
                  style={{
                    color: "var(--mkt-muted-dark)",
                    fontSize: "1rem",
                    lineHeight: 1.55,
                  }}
                >
                  Get first access to off-market Puget Sound investment
                  properties — wholesale deals, creative-finance opportunities,
                  and fixer-uppers delivered to your inbox.
                </p>

                <ul className="mt-6 space-y-2 font-mkt-sans text-sm">
                  {["Weekly deal drops", "No spam, ever"].map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-3"
                      style={{ color: "var(--mkt-text-on-dark)" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--mkt-olive-light)" }}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* RIGHT — investor form */}
              <div
                className="md:col-span-6 w-full rounded-xl p-6 sm:p-7 lg:p-8"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(245,239,226,0.06)",
                }}
              >
                <form className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <Field label="First Name" placeholder="Jane" />
                    <Field label="Last Name" placeholder="Doe" />
                  </div>
                  <Field
                    label="Email"
                    placeholder="jane@example.com"
                    type="email"
                  />
                  <Field
                    label="Markets of Interest"
                    placeholder="Tacoma, Seattle, Olympia"
                  />
                  <button
                    type="button"
                    className="w-full rounded-full font-mkt-sans py-3.5 transition-opacity hover:opacity-90"
                    style={{
                      background: "var(--mkt-olive)",
                      color: "var(--mkt-cream)",
                      fontWeight: 500,
                      fontSize: "0.95rem",
                    }}
                  >
                    Join the Buyers List
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer body — dark background */}
      <footer
        className="w-full"
        style={{
          background: "var(--mkt-dark)",
          color: "var(--mkt-text-on-dark)",
        }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-8 sm:pt-10 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-10">
            <div className="sm:col-span-4">
              <div className="flex items-center gap-3">
                <div
                  className="font-mkt-display"
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 500,
                    color: "var(--mkt-text-on-dark)",
                  }}
                >
                  BT Investments
                </div>
              </div>
              <div
                className="font-mkt-sans uppercase tracking-[0.28em] mt-1.5 text-[0.65rem]"
                style={{ color: "var(--mkt-muted-dark)" }}
              >
                Puget Sound Real Estate
              </div>
              <p
                className="font-mkt-sans mt-6 text-sm max-w-xs"
                style={{
                  color: "var(--mkt-muted-dark)",
                  lineHeight: 1.5,
                }}
              >
                Family-owned real estate investment group helping Puget Sound
                homeowners sell on their terms — cash, creative, or listed.
              </p>
            </div>

            <FooterColumn title="Sell" links={SELL_LINKS} />
            <FooterColumn title="Company" links={COMPANY_LINKS} />
          </div>

          {/* Bottom legal row */}
          <div
            className="mt-14 pt-6 flex flex-col sm:flex-row sm:justify-between gap-4 font-mkt-sans text-xs"
            style={{
              borderTop: "1px solid rgba(245,239,226,0.08)",
              color: "var(--mkt-muted-dark)",
            }}
          >
            <div>
              © {new Date().getFullYear()} BT Investments LLC. All rights reserved.
            </div>
            <div className="flex gap-6">
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="hover:opacity-80 transition-opacity"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div
        className="font-mkt-sans uppercase tracking-[0.18em] text-[0.65rem] mb-2"
        style={{ color: "var(--mkt-muted-dark)" }}
      >
        {label}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 font-mkt-sans text-base outline-none pb-2 placeholder-opacity-50"
        style={{
          color: "var(--mkt-text-on-dark)",
          borderBottom: "1px solid rgba(245,239,226,0.18)",
        }}
      />
    </label>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="sm:col-span-4">
      <div
        className="font-mkt-sans uppercase tracking-[0.28em] text-[0.65rem]"
        style={{ color: "var(--mkt-olive)" }}
      >
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="font-mkt-sans text-base hover:opacity-80 transition-opacity"
              style={{ color: "var(--mkt-text-on-dark)" }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
