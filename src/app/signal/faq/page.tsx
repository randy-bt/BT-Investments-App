import type { Metadata } from "next";
import Link from "next/link";

// Signal FAQ (handoff 003a): copy word for word, FAQPage schema, linked
// quietly from /signal. Rules baked into the copy: no dollar figures,
// no delivery-time promises, no assurance wording, zero em-dashes.

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "What exactly do you build?",
    a: "Custom AI tools for small businesses. A few examples: Missed Call Recovery, a Virtual Front Desk, an Instant Quote Generator, Automated Follow-Ups, a No-Show Shield, an AI Bookkeeping Assistant, a Reputation Manager for reviews. If a task eats your hours and follows a pattern, we can probably build the tool that does it.",
  },
  {
    q: "What does it cost?",
    a: "Every tool is priced by what it takes to build it. A simple single-job tool costs less than a system that touches your calendar, your phones, and your books. Tell us what you need and the quote comes back with the solution, the tool, and the price. No obligation.",
  },
  {
    q: "Why is there a monthly fee?",
    a: "That is the maintenance side: updates, upkeep, and making sure your tool keeps running smoothly as your business and the technology around it change. You are not buying software and getting abandoned. We stay on it.",
  },
  {
    q: "What does the monthly fee cover exactly?",
    a: "It depends on the tool, because every tool is different. The scope is spelled out in your agreement before you pay anything.",
  },
  {
    q: "How long does it take?",
    a: "Depends on the tool. Your quote includes the timeline for your specific build, and the timeline we agree on goes in the agreement.",
  },
  {
    q: "Do I need to be technical?",
    a: "No. You describe the problem in plain words, a voice note works great. We handle everything technical. That is the whole point of us.",
  },
  {
    q: "Will it work with the stuff I already use?",
    a: "Usually, yes. Calendars, phones, spreadsheets, QuickBooks, booking systems. Mention what you use when you send your note and the quote will say exactly how it connects.",
  },
  {
    q: "Who owns the tool?",
    a: "The tool is built for your business and stays with your business while we work together. The specifics live in your agreement, in plain English.",
  },
  {
    q: "What happens to my data?",
    a: "It stays yours. We do not sell it, share it, or train public AI models on it. Tools are built so your business information stays inside your business.",
  },
  {
    q: "What if I want changes later?",
    a: "Small adjustments are part of keeping the tool healthy. Bigger additions get quoted like a new piece of work. Most clients start small and add on once the first tool proves itself.",
  },
  {
    q: "What kind of businesses do you work with?",
    a: "Small and medium businesses that run on real work: trades, services, offices, shops. If your day is full of calls, quotes, scheduling, paperwork, or follow-ups, you are exactly who this is for.",
  },
  {
    q: "How do I start?",
    a: "Tell us what your business needs at btinvestments.co/signal. Talk it out or type it out, attach photos if they help. We send back the solution, the tool, and the price.",
  },
];

export const metadata: Metadata = {
  title: "Signal FAQ",
  description:
    "Answers about Signal custom AI tools: what we build, how quotes work, timelines, ownership, your data, and how to start.",
  alternates: { canonical: "https://btinvestments.co/signal/faq" },
};

export default function SignalFaqPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="sig-faq-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="sig-faq-inner">
        <Link href="/signal" className="sig-faq-back">
          &larr; back to Signal
        </Link>
        <div className="sig-faq-eyebrow">
          <span className="sig-faq-dot" />
          Signal
        </div>
        <h1>
          Questions, <em>answered</em>.
        </h1>
        <div className="sig-faq-list">
          {FAQS.map((f, i) => (
            <section key={i} className="sig-faq-item">
              <h2>{f.q}</h2>
              <p>{f.a}</p>
            </section>
          ))}
        </div>
        <p className="sig-faq-cta">
          Ready when you are.{" "}
          <Link href="/signal">Tell us what your business needs</Link>
        </p>
      </div>
    </main>
  );
}
