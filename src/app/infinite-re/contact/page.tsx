"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Infinite RE — Services + Contact (single page).
 *
 * Two-column layout: real-estate-media services on the left, contact
 * form on the right. Form posts to /api/forms/submit with the existing
 * "Infinite RE - Contact Form" form_name so the email pipeline + DB
 * insert work without any backend changes.
 */

const SERVICES = [
  {
    name: "Photography",
    desc: "Interior · Exterior · Detail",
  },
  {
    name: "Videography",
    desc: "Walkthrough · Highlight · Story",
  },
  {
    name: "Reels & Social",
    desc: "Instagram · TikTok · YouTube Shorts",
  },
  {
    name: "Aerial / Drone",
    desc: "Stills · Video · Lot Views",
  },
  {
    name: "Agent Branding",
    desc: "Headshots · Brand · Content Systems",
  },
  {
    name: "Agent Websites",
    desc: "Modern · Intuitive · Branded",
  },
];

const INTERESTS = SERVICES.map((s) => s.name);

/**
 * Form field wrapper — uppercase tracked label above the input so
 * users always know what field they're in (placeholders disappear
 * once you start typing). Required fields get a small gold marker.
 */
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block font-sans text-[10px] tracking-[0.28em] uppercase mb-2"
        style={{ color: "#888" }}
      >
        {label}
        {required && (
          <span className="ml-1.5" style={{ color: "#b49a5c" }}>
            ✱
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export default function InfiniteReContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dates, setDates] = useState("");
  const [message, setMessage] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Form starts collapsed behind a single Contact pill; expands on
  // click. Reduces visual weight of the page on first load and turns
  // sending an inquiry into an explicit, intentional action.
  const [formOpen, setFormOpen] = useState(false);

  // Auto-grow the message textarea so it starts compact (2 rows) and
  // expands naturally as the user types instead of always reserving a
  // big block of vertical space.
  const messageRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = messageRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [message]);

  const canSubmit = !!(name.trim() && email.trim() && message.trim());

  function toggleInterest(s: string) {
    setInterests((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data: Record<string, string> = {
        Name: name.trim(),
        Email: email.trim(),
        Message: message.trim(),
      };
      if (phone.trim()) data["Phone"] = phone.trim();
      if (dates.trim()) data["Requested Dates"] = dates.trim();
      if (interests.length > 0)
        data["Services Interested"] = interests.join(", ");
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_name: "Infinite RE - Contact Form",
          data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Submission failed. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  // Bottom-border-only inputs — no card, no fill, just a hairline.
  // Reads as editorial / luxury rather than generic form.
  const inputClass =
    "w-full px-1 py-3 bg-transparent border-0 border-b border-[#d8d6d0] text-[#161614] placeholder:text-[#9a978f] font-sans text-[15px] focus:outline-none focus:border-[#b49a5c] transition-colors disabled:opacity-60";

  return (
    <section className="flex-1 px-6 sm:px-10 lg:px-14 pb-20 pt-6 overflow-y-auto min-h-0">
      {/* Tiny back link — replaces the layout nav we stripped */}
      <Link
        href="/infinite-re"
        className="font-sans text-[11px] tracking-[0.32em] uppercase text-[#888] hover:text-[#b49a5c] transition-colors"
      >
        ← Back
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto pt-6 pb-10 sm:pt-10 sm:pb-14 text-center"
      >
        <span
          className="font-sans text-[11px] tracking-[0.32em] uppercase"
          style={{ color: "#b49a5c" }}
        >
          Services / Contact
        </span>
        <h1
          className="leading-[1.02] tracking-tight mt-4"
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: "clamp(2.5rem, 5vw, 4.25rem)",
            fontWeight: 600,
            color: "#161614",
          }}
        >
          Make everything feel{" "}
          <span style={{ fontStyle: "italic", color: "#b49a5c" }}>
            intentional
          </span>
          .
        </h1>
        <p
          className="font-sans mt-5 max-w-xl mx-auto"
          style={{
            color: "#555",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          Tell us about your vision. We&apos;ll come back with a plan, a
          quote, and dates.
        </p>
      </motion.div>

      {/* SERVICES — restaurant-menu treatment, mirroring the Infinite
          Media menu: italic serif section heading framed by hairlines,
          then each row has the service name on the left, a dotted
          connector running across, and the small tagged description
          on the right. */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="h-px flex-1" style={{ background: "#d8d6d0" }} />
          <span
            className="italic"
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: "1.1rem",
              color: "#666",
            }}
          >
            Menu of Services
          </span>
          <span className="h-px flex-1" style={{ background: "#d8d6d0" }} />
        </div>
        <ul className="flex flex-col gap-3 mb-5">
          {SERVICES.map((s) => (
            <motion.li
              key={s.name}
              whileHover={{ scale: 1.025 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-3 py-1 origin-center cursor-default group"
            >
              <span
                className="sm:whitespace-nowrap leading-tight transition-colors group-hover:text-[#b49a5c]"
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: "clamp(1.2rem, 1.5vw, 1.5rem)",
                  fontWeight: 600,
                  color: "#161614",
                }}
              >
                {s.name}
              </span>
              <span
                aria-hidden
                className="hidden sm:block flex-1 border-b border-dotted"
                style={{
                  borderColor: "#cfccc4",
                  transform: "translateY(-4px)",
                }}
              />
              <span
                className="font-sans tracking-[0.14em] uppercase sm:whitespace-nowrap transition-colors group-hover:text-[#333]"
                style={{
                  color: "#888",
                  fontSize: "0.7rem",
                  fontWeight: 500,
                }}
              >
                {s.desc}
              </span>
            </motion.li>
          ))}
        </ul>
        <p
          className="font-sans text-center italic"
          style={{
            color: "#888",
            fontSize: "0.85rem",
            lineHeight: 1.55,
          }}
        >
          Don&apos;t see what you need? This is just a snapshot of what we
          do. Let&apos;s talk.
        </p>
      </motion.div>

      {/* FORM — collapsed behind a Contact pill on first load to
          reduce visual weight; expands inline on click. Once a
          submission completes, we keep the success state inline (no
          collapse). Bottom-border-only inputs read editorial rather
          than form-y. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="max-w-3xl mx-auto mt-12 sm:mt-16"
      >
        {/* Pill — only visible while the form is closed and not yet
            submitted. Click expands the form below. */}
        {!formOpen && !submitted && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="font-sans inline-flex items-center gap-3 rounded-full px-9 py-4 transition-colors text-[16px] tracking-[0.2em] uppercase font-medium bg-[#161614] hover:bg-[#b49a5c] text-white"
              aria-expanded={formOpen}
              aria-controls="infinite-re-contact-form"
            >
              Contact
              <span aria-hidden className="transition-transform">↓</span>
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {(formOpen || submitted) && (
            <motion.div
              id="infinite-re-contact-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
        <div className="pb-2 pt-2">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(180,154,92,0.18)" }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#b49a5c"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3
                  className="leading-tight"
                  style={{
                    fontFamily: "var(--font-cormorant), Georgia, serif",
                    fontSize: "1.65rem",
                    fontWeight: 600,
                    color: "#161614",
                  }}
                >
                  Message received.
                </h3>
                <p
                  className="font-sans max-w-sm"
                  style={{
                    color: "#555",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  We&apos;ll be in touch within a business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-7">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="h-px flex-1"
                    style={{ background: "#d8d6d0" }}
                  />
                  <h3
                    className="italic"
                    style={{
                      fontFamily: "var(--font-cormorant), Georgia, serif",
                      fontSize: "1.65rem",
                      color: "#555",
                      fontWeight: 500,
                    }}
                  >
                    Contact
                  </h3>
                  <span
                    className="h-px flex-1"
                    style={{ background: "#d8d6d0" }}
                  />
                </div>
                {/* Persistent labels above each input — once you start
                    typing, you still know which field is which. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-6">
                  <Field label="Name" required>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Email" required>
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      placeholder="(206) 555 0142"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={submitting}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="Requested Dates">
                  <input
                    type="text"
                    placeholder="ASAP, week of June 10, flexible…"
                    value={dates}
                    onChange={(e) => setDates(e.target.value)}
                    disabled={submitting}
                    className={inputClass}
                  />
                </Field>

                <Field label="Tell Us Your Vision" required>
                  <textarea
                    ref={messageRef}
                    placeholder="Property type, location, scope, anything we should know…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={submitting}
                    rows={1}
                    className={`${inputClass} resize-none overflow-hidden`}
                  />
                </Field>

                <div className="flex flex-col gap-2.5 mt-1">
                  <span
                    className="font-sans text-[10.5px] tracking-[0.22em] uppercase"
                    style={{ color: "#888" }}
                  >
                    Services Interested In
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((s) => {
                      const active = interests.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleInterest(s)}
                          disabled={submitting}
                          className={`px-3 py-2 rounded-full font-sans text-[11.5px] whitespace-nowrap transition-colors disabled:opacity-50 border hover:bg-[#b49a5c] hover:border-[#b49a5c] ${
                            active
                              ? "bg-[#161614] text-white border-[#161614]"
                              : "bg-[#ffffff] text-[#555] border-[#d8d6d0]"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="font-sans text-[12.5px] text-[#a02e2e]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="px-6 py-3 rounded-full font-sans text-[13px] tracking-[0.16em] uppercase font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#161614] self-start bg-[#161614] hover:bg-[#b49a5c] text-white"
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </section>
  );
}
