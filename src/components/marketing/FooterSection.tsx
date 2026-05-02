"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CTA2Form } from "./CTA2Form";

const VIEWPORT = { once: true, amount: 0.25 };

/**
 * Smart in-page Link. Default Next.js Link behavior is fine for
 * cross-page navigation, but breaks down for in-page targets:
 *   - href="/" while already on "/" → silent no-op (looks broken)
 *   - href="/#section" while on "/" → instant jump, no smooth scroll
 * This wrapper detects same-page targets and smooth-scrolls instead.
 * Cross-page links pass through to Next.js untouched.
 */
function HomeAwareLink({
  href,
  className,
  style,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Split href into path part + optional hash. "/" has no hash; "/#x" has
  // path "/" and hash "x"; "/page#x" has path "/page" and hash "x".
  const hashIndex = href.indexOf("#");
  const targetPath = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const targetHash = hashIndex === -1 ? "" : href.slice(hashIndex + 1);
  const isSamePage = targetPath === pathname || targetPath === "";

  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!isSamePage) return; // let Next handle cross-page nav
        e.preventDefault();
        if (targetHash) {
          const el = document.getElementById(targetHash);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

/**
 * Footer + CTA2
 *
 * Two visually-distinct sections:
 *   1. CTA2 (top): white background, with a dark inner card containing
 *      the investor signup form. Side-by-side text + form on tablet+.
 *   2. Footer body (bottom): dark background. 3-column footer + legal row.
 */

const EXPLORE_LINKS = [
  { label: "Home", href: "/" },
  { label: "Our Process", href: "/#how-it-works" },
  { label: "Where We Buy", href: "/where-we-buy" },
  { label: "FAQ", href: "/faq" },
];

const CONNECT_LINKS = [
  { label: "aldo@btinvestments.co", href: "mailto:aldo@btinvestments.co" },
  // CTA2 entry point — sits under the email so investors have a clear
  // signup path alongside the contact info.
  { label: "Join Our Buyers List", href: "/#buyers-list" },
];

// Privacy / Terms / Disclosures all just route to "/" which scrolls
// to the top of the homepage — no dedicated pages exist yet.
const LEGAL_LINKS = [
  { label: "Privacy", href: "/" },
  { label: "Terms", href: "/" },
  { label: "Disclosures", href: "/" },
];

/**
 * Combined CTA2 + Footer body — convenience export for the homepage,
 * which uses both. Inner pages should import { FooterBody } directly
 * and skip CTA2Section.
 */
export function FooterSection() {
  return (
    <>
      <CTA2Section />
      <FooterBody />
    </>
  );
}

/** White-bg section with the dark inner CTA2 card (investor signup form). */
export function CTA2Section() {
  return (
    <>
      <section
        id="buyers-list"
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
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
                  style={{ color: "var(--mkt-olive)" }}
                >
                  For Investors
                </motion.div>

                {/* Serif headline with italic-olive on "buy" */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  className="font-mkt-display mt-5"
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 3.75rem)",
                    lineHeight: 1.05,
                    fontWeight: 500,
                    color: "var(--mkt-text-on-dark)",
                  }}
                >
                  Looking to{" "}
                  <motion.em
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={VIEWPORT}
                    transition={{
                      duration: 0.55,
                      delay: 0.45,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="font-mkt-display italic inline-block"
                    style={{
                      color: "var(--mkt-olive-light)",
                      fontStyle: "italic",
                      fontWeight: 600,
                    }}
                  >
                    buy
                  </motion.em>{" "}
                  instead?
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                  className="font-mkt-sans mt-6 max-w-md"
                  style={{
                    color: "var(--mkt-muted-dark)",
                    fontSize: "1rem",
                    lineHeight: 1.55,
                  }}
                >
                  Get first access to off-market investment properties.
                  Wholesale deals, creative-finance opportunities, and
                  fixer-uppers delivered to your inbox.
                </motion.p>

                <ul className="mt-6 space-y-2 font-mkt-sans text-sm">
                  {[
                    "Off-market only",
                    "Direct from us, no middleman",
                  ].map((b, i) => (
                    <motion.li
                      key={b}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={VIEWPORT}
                      transition={{
                        duration: 0.5,
                        ease: "easeOut",
                        delay: 0.7 + i * 0.1,
                      }}
                      className="flex items-center gap-3"
                      style={{ color: "var(--mkt-text-on-dark)" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--mkt-olive-light)" }}
                      />
                      {b}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* RIGHT — investor form. Uses the CTA2Form client component
                  which captures the 4 short fields and routes the user to
                  /join-buyers-list (carrying the values as URL params for
                  pre-fill on the long-form). */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                className="md:col-span-6 w-full rounded-xl p-6 sm:p-7 lg:p-8"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(245,239,226,0.06)",
                }}
              >
                <CTA2Form />
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Dark-bg footer with 3-column links + legal row. Used on every page. */
export function FooterBody() {
  return (
    <>
      <footer
        className="w-full"
        style={{
          background: "var(--mkt-dark)",
          color: "var(--mkt-text-on-dark)",
        }}
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-8 sm:pt-10 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-10">
            {/* Brand 6 cols on the left, two link columns 3 cols each on
                the right — visually clusters the link list to the
                right-hand half of the footer. */}
            <div className="sm:col-span-6">
              {/* Branding wordmark — BT / INVESTMENTS stack matching the
                  homepage hero. Clickable, links to / (homepage top). */}
              <HomeAwareLink
                href="/"
                className="inline-block transition-opacity hover:opacity-80"
                ariaLabel="BT Investments — back to home"
              >
                <div
                  className="font-mkt-display leading-none tracking-tight"
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 500,
                    color: "var(--mkt-text-on-dark)",
                  }}
                >
                  BT
                </div>
                <div
                  className="font-mkt-sans uppercase mt-1 tracking-[0.32em]"
                  style={{
                    color: "var(--mkt-olive-light)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                  }}
                >
                  Investments
                </div>
              </HomeAwareLink>
              <p
                className="font-mkt-sans mt-6 text-sm max-w-xs"
                style={{
                  color: "var(--mkt-muted-dark)",
                  lineHeight: 1.5,
                }}
              >
                Local real estate investment group helping homeowners sell on
                their terms. Direct offer, creative terms, or on-market
                listing.
              </p>
            </div>

            <FooterColumn title="Explore" links={EXPLORE_LINKS} />
            <FooterColumn
              title="Connect"
              links={CONNECT_LINKS}
              cta={{ label: "Get Your Offer", href: "/sell-property" }}
            />
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
              © {new Date().getFullYear()} BT Investments. All Rights Reserved.
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


function FooterColumn({
  title,
  links,
  cta,
}: {
  title: string;
  links: { label: string; href: string }[];
  cta?: { label: string; href: string };
}) {
  return (
    <div className="sm:col-span-3">
      <div
        className="font-mkt-sans uppercase tracking-[0.28em] text-[0.65rem]"
        style={{ color: "var(--mkt-olive)" }}
      >
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <HomeAwareLink
              href={l.href}
              className="font-mkt-sans text-base hover:opacity-80 transition-opacity"
              style={{ color: "var(--mkt-text-on-dark)" }}
            >
              {l.label}
            </HomeAwareLink>
          </li>
        ))}
      </ul>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-flex items-center justify-center rounded-full font-mkt-sans px-5 py-2.5 transition-opacity hover:opacity-90"
          style={{
            background: "var(--mkt-olive)",
            color: "var(--mkt-cream)",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
