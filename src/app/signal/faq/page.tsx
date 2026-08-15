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
  // Handoff 013 expansion (7/26): entries 13-22, Randy-approved word for word.
  {
    q: "Why can't I just use ChatGPT or something similar myself?",
    a: "You can, and it is a fair place to start. Anyone can open ChatGPT or any AI app, and with enough time you might piece together something that sort of works. The difference is between chatting with an AI and owning a tool that does a real job inside your business every day without being babysat. Building that takes a deeper understanding of systems: how the AI connects to your calendar, your phones, your files, and what keeps it running on a busy Tuesday. That is the part we do for a living, so you do not have to learn it.",
  },
  {
    q: "What happens after I submit?",
    a: "Our team reads your submission, usually more than once. Then we reach out with ideas: what we would build, how it would work in your business, and what it costs. From there it is a conversation, not a commitment. You say yes or no.",
  },
  {
    q: "Where does the tool live? Do I have to install anything?",
    a: "Every tool is custom, so it varies. Some are a simple page you log into. Some live inside the systems you already use. Either way, setup is our job, not yours.",
  },
  {
    q: "Will I know exactly what I'm getting before I commit?",
    a: "Yes. Before we build anything, we go over the tool with you in detail: what it does, how you will use it, what it connects to. What arrives is what you approved. No surprises is the whole business model.",
  },
  {
    q: "My business is niche. Can you build for me?",
    a: "Yes. Custom means custom. Pool routes, taxidermy, wedding DJs, a steel yard: if your business has a repeating job that eats hours, a tool can be built around exactly how you do it. The more unusual your business, the less any off-the-shelf software fits, and the more sense a custom tool makes.",
  },
  {
    q: "Is the tool hard to learn?",
    a: "No. Simple is the whole point. Every tool is built to be intuitive, and we train you and your team until it feels obvious. If a tool needs a thick manual, we built it wrong.",
  },
  {
    q: "What about AI mistakes I keep hearing about?",
    a: "The horror stories come from open-ended chatbots doing jobs they were never designed for. Our tools are a different animal: each one is built for one specific job, with guardrails around what it can do and checkpoints that keep you in control of anything that matters.",
  },
  {
    q: "What should my first tool be?",
    a: "The job you complain about most. Tell us the thing you would pay to never do again, and that is usually the perfect first tool. Start small, let it prove itself, add from there.",
  },
  {
    q: "Do you work with businesses worldwide?",
    a: "Yes. Signal is based in Seattle and works with businesses worldwide. Intake, delivery, and training all happen remotely just fine.",
  },
  {
    q: "Who is behind Signal?",
    a: "A Seattle-based team of builders. We saw how in demand AI has become and how few businesses have a real way to use it, so we built the bridge: custom tools that bring the power of AI into everyday businesses. We build every tool in-house and stay with it after it ships.",
  },
];

export const metadata: Metadata = {
  title: { absolute: "Signal FAQ" },
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
