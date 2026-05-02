"use client";

import { motion } from "framer-motion";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FixedBrandingHeader } from "@/components/marketing/FixedBrandingHeader";
import { CTA1Inline } from "@/components/marketing/CTA1Inline";
import { FooterBody } from "@/components/marketing/FooterSection";

const VIEWPORT = { once: true, amount: 0.2 };

/**
 * FAQ content — grouped into sections for scannability. Each section is
 * rendered as a labeled block of <details> accordions.
 */
const FAQ_SECTIONS = [
  {
    section: "The Process",
    items: [
      {
        q: "How does the offer process work?",
        a: "We review your property, run our numbers, and give you a clear, no-obligation offer.",
      },
      {
        q: "What happens after I submit the form?",
        a: "Our team reviews your submission and gets back to you with a no-obligation offer within 24–48 hours. No pressure, no commitments — just a conversation.",
      },
      {
        q: "How fast can I get an offer?",
        a: "Usually within 24–48 hours after we review the details.",
      },
      {
        q: "How long does the entire process take?",
        a: "Most sales close in about 30 days; we can sometimes close in as little as two weeks.",
      },
      {
        q: "Can I choose my closing date?",
        a: "Yes, you pick the date that works for you.",
      },
      {
        q: "Will you visit my home in person before making an offer?",
        a: "Sometimes, but often we can make a fair offer with photos or a quick walkthrough.",
      },
      {
        q: "Who handles the paperwork and closing process?",
        a: "A licensed local title/escrow company handles everything, so it's professional, legal, and secure.",
      },
    ],
  },
  {
    section: "Property & Condition",
    items: [
      {
        q: "Do I need to make repairs, clean, or stage my home before selling?",
        a: "No. We buy as-is, in any condition. Outdated kitchens, deferred maintenance, even hoarder situations — none of it matters. Leave the house exactly how it is and we'll handle the rest after closing.",
      },
      {
        q: "What if my home needs a lot of work?",
        a: "No problem. We specialize in properties that need repairs.",
      },
      {
        q: "What types of homes do you buy?",
        a: "We buy single-family homes, condos, townhomes, vacant land, and multi-family properties.",
      },
      {
        q: "How do you determine my home's offer price?",
        a: "We look at location, condition, recent sales in your area, and your timeline.",
      },
    ],
  },
  {
    section: "Fees & Closing",
    items: [
      {
        q: "What fees, commissions, or closing costs will I pay?",
        a: "None. There are no agent commissions, no hidden fees, and we typically cover all standard closing costs. Everything is transparent and upfront — the number we offer is the number that hits your bank account.",
      },
    ],
  },
  {
    section: "Special Situations",
    items: [
      {
        q: "Can I sell my home if I still have a mortgage?",
        a: "Yes. We'll work with your lender and pay off your balance at closing.",
      },
      {
        q: "I'm behind on mortgage payments or facing foreclosure — can you still help?",
        a: "Yes — we work with sellers in this situation regularly. The complexity varies case by case, so we'll need details to understand your options, but there's almost always a path forward we can take together.",
      },
      {
        q: "I'm out of state but the property is in Washington — can I still sell to you?",
        a: "Yes, of course. We work with out-of-state owners all the time — it's a common scenario in our market. Distance doesn't change anything about the process.",
      },
      {
        q: "Will you still buy my house if it has tenants?",
        a: "Yes, we can buy properties with tenants in place.",
      },
      {
        q: "Do you buy properties with liens, code violations, or back taxes?",
        a: "Yes. We'll work with you to resolve those issues at closing.",
      },
      {
        q: "What about inherited or probate properties?",
        a: "Yes, we regularly buy inherited homes. We'll help guide you through the process.",
      },
      {
        q: "What if I already have an agent?",
        a: "You can still sell to us, but your agent agreement may apply.",
      },
      {
        q: "What if I already listed my home but it hasn't sold?",
        a: "You can still work with us. We'll review your situation and present options.",
      },
    ],
  },
  {
    section: "Listing & Creative Options",
    items: [
      {
        q: "What is creative financing, and how does it work?",
        a: "It lets you sell without a traditional loan. It can help if you want a higher price or more flexible terms.",
      },
      {
        q: "Can I list my home instead of selling directly?",
        a: "Yes. We have experienced investor/brokers on our team who can help you list your home.",
      },
      {
        q: "What are the benefits of listing with your investor-broker team instead of a traditional agent?",
        a: "Our team knows both investing and the market. We bring buyers, speed, and experience to get you the best results.",
      },
      {
        q: "How are you different from an agent?",
        a: "We can buy directly, offer creative solutions, or list with our broker team. You choose.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="marketing-scope">
      <MarketingNav />
      <FixedBrandingHeader />

      {/* Header — eyebrow / headline / italic / body cascade in on mount */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-7xl px-6 sm:px-10 pt-28 sm:pt-32 pb-8 sm:pb-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
            style={{ color: "var(--mkt-olive)" }}
          >
            Frequently Asked
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="font-mkt-display mt-5 sm:mt-6"
            style={{
              fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 700,
              color: "var(--mkt-text-on-light)",
            }}
          >
            The questions{" "}
            <motion.em
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.5,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="font-mkt-display italic inline-block"
              style={{ color: "#8a9550", fontStyle: "italic" }}
            >
              we hear most.
            </motion.em>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
            className="font-mkt-sans mt-6 max-w-2xl text-base sm:text-lg"
            style={{
              color: "var(--mkt-muted-light)",
              lineHeight: 1.55,
            }}
          >
            If your question isn&apos;t here, give us a call or shoot us an
            email and we&apos;ll get back to you.
          </motion.p>
        </div>
      </section>

      {/* FAQ accordion — grouped into sections; uses native
          <details>/<summary> for accessibility and zero-JS expand/collapse.
          Each section heading slides in when the block scrolls into view,
          and the accordions inside cascade up one after another. */}
      <section className="w-full" style={{ background: "var(--mkt-cream)" }}>
        <div className="mx-auto max-w-3xl px-6 sm:px-10 pb-4 sm:pb-6">
          {FAQ_SECTIONS.map((section, sIdx) => (
            <div
              key={section.section}
              className={sIdx === 0 ? "" : "mt-12 sm:mt-16"}
            >
              {/* Section heading */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
                style={{ color: "var(--mkt-olive)" }}
              >
                {section.section}
              </motion.div>

              {/* Section accordions — cascade in with index-based delay */}
              <div className="mt-4">
                {section.items.map((item, qIdx) => (
                  <motion.details
                    key={item.q}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={VIEWPORT}
                    transition={{
                      duration: 0.5,
                      ease: "easeOut",
                      delay: 0.15 + qIdx * 0.06,
                    }}
                    className="group py-6 cursor-pointer"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <summary
                      className="font-mkt-display flex justify-between items-start gap-6 list-none"
                      style={{
                        fontSize: "clamp(1.15rem, 1.6vw, 1.4rem)",
                        fontWeight: 500,
                        lineHeight: 1.35,
                        color: "var(--mkt-text-on-light)",
                      }}
                    >
                      <span>{item.q}</span>
                      <span
                        className="shrink-0 font-mkt-sans transition-transform group-open:rotate-45"
                        style={{
                          color: "var(--mkt-olive)",
                          fontSize: "1.5rem",
                          lineHeight: 1,
                          fontWeight: 300,
                        }}
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p
                      className="font-mkt-sans mt-4 max-w-2xl"
                      style={{
                        color: "var(--mkt-muted-light)",
                        fontSize: "0.95rem",
                        lineHeight: 1.65,
                      }}
                    >
                      {item.a}
                    </p>
                  </motion.details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA1 — bottom-of-page conversion card */}
      <CTA1Inline
        eyebrow="Still curious?"
        title={
          <>
            Skip the questions,{" "}
            <em
              className="font-mkt-display italic"
              style={{ color: "var(--mkt-olive-light)", fontStyle: "italic" }}
            >
              get an offer.
            </em>
          </>
        }
        body="Tell us about your home and we'll send you a no-obligation cash offer within 24 hours. No commitments, no pressure, just a number to consider."
      />

      <FooterBody />
    </div>
  );
}
