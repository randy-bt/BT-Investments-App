"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/**
 * HelloBuyersForm — multi-step investor intake rendered inside the Hello
 * portal card. Hello-aesthetic UI but captures the SAME fields and posts
 * to the SAME endpoint with the SAME form_name as the marketing-site
 * BuyersListForm. Pre-fills name/email/phone from URL params if the
 * user arrived from the homepage CTA2 short form.
 */

const INVESTOR_TYPES = [
  "Investor (active)",
  "First-time / new investor",
  "Agent",
  "Wholesaler",
  "Hedge fund / Institutional",
  "Other",
];

const INVESTMENT_TYPES = [
  "Single Family",
  "Multi-Family (2–4 units)",
  "Multi-Family (5+ units)",
  "Condo / Townhouse",
  "Mobile / Manufactured",
  "Land",
  "Commercial",
  "Mixed-Use",
];

const FINANCING_TYPES = [
  "Cash",
  "Conventional loan",
  "Hard money / Private lender",
  "Seller financing",
  "Subject-to existing mortgage",
  "Lease option",
  "Other",
];

const IDEAL_CONDITIONS = [
  "Turnkey (move-in ready)",
  "Cosmetic updates only",
  "Light rehab",
  "Heavy rehab",
  "Tear-down",
];

const INVESTMENT_STRATEGIES = [
  "Buy & Hold (rentals)",
  "Fix & Flip",
  "BRRRR",
  "Wholesale (assignment)",
  "Owner-occupy",
  "Short-term rental (Airbnb/VRBO)",
  "Land / Development",
  "Section 8",
];

const TIMELINES = [
  "Ready now",
  "Within 30 days",
  "30–60 days",
  "60–90 days",
  "90+ days",
  "Just researching the market",
];

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[14px] focus:outline-none focus:border-[#999]";

const labelClass =
  "block font-sans text-[12px] font-medium text-[#555] mb-1.5 tracking-wide";

const primaryBtn =
  "px-5 py-2.5 rounded-full bg-[#6d8048] text-white font-sans text-[14px] font-medium hover:bg-[#5a6b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryBtn =
  "px-5 py-2.5 rounded-full bg-transparent text-[#666] font-sans text-[14px] font-medium hover:text-[#161616] transition-colors";

/** Label + red asterisk for required fields. */
function Lbl({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className={labelClass}>
      {children}
      {required && <span className="text-[#a02e2e] ml-0.5">*</span>}
    </label>
  );
}

// Chip component for multi-select fields. Toggles selection on click.
function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full font-sans text-[12.5px] font-medium transition-colors ${
        selected
          ? "bg-[#6d8048] text-white"
          : "bg-white border border-[#ddd] text-[#555] hover:border-[#999]"
      }`}
    >
      {label}
    </button>
  );
}

function MultiChips({
  options,
  values,
  onChange,
}: {
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]
    );
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          selected={values.includes(opt)}
          onToggle={() => toggle(opt)}
        />
      ))}
    </div>
  );
}

export function HelloBuyersForm({
  fit,
  onBack,
}: {
  fit: number;
  onBack: () => void;
}) {
  const params = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — pre-filled from CTA2 short form params
  const [name, setName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [investorType, setInvestorType] = useState("");

  // Step 2 — criteria
  const [locations, setLocations] = useState("");
  const [investmentTypes, setInvestmentTypes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState("");
  const [financingTypes, setFinancingTypes] = useState<string[]>([]);
  const [bedsBaths, setBedsBaths] = useState("");
  const [propertyAge, setPropertyAge] = useState("");
  const [idealConditions, setIdealConditions] = useState<string[]>([]);
  const [dealBreakers, setDealBreakers] = useState("");

  // Step 3 — strategy
  const [investmentStrategies, setInvestmentStrategies] = useState<string[]>(
    []
  );
  const [propertiesPerYear, setPropertiesPerYear] = useState("");
  const [timeline, setTimeline] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [consent, setConsent] = useState(false);

  const canAdvance1 = !!(name && email && phone && investorType);
  const canAdvance2 = !!(
    locations &&
    investmentTypes.length > 0 &&
    priceRange &&
    financingTypes.length > 0
  );
  const canSubmit = !!(timeline && consent);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const data: Record<string, string> = {};
    const set = (key: string, value: string) => {
      if (value && value.trim()) data[key] = value;
    };
    set("Name / Company", name);
    set("Email", email);
    set("Phone", phone);
    set("Investor Type", investorType);
    set("Locations Interested", locations);
    set("Investment Types", investmentTypes.join(", "));
    set("Price Range", priceRange);
    set("Financing Types", financingTypes.join(", "));
    set("Min Beds / Baths", bedsBaths);
    set("Preferred Property Age", propertyAge);
    set("Ideal Condition", idealConditions.join(", "));
    set("Deal Breakers", dealBreakers);
    set("Investment Strategy", investmentStrategies.join(", "));
    set("Properties This Year", propertiesPerYear);
    set("Timeline to Purchase", timeline);
    set("Additional Info", additionalInfo);
    set("Consent", consent ? "Yes" : "No");

    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // SAME form_name as marketing BuyersListForm.
        body: JSON.stringify({
          form_name: "BT Investments - Join Buyers List",
          data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.error ?? "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Submission failed. Please check your connection.");
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="relative w-[620px] max-w-[92vw] rounded-[32px] bg-[#f4f2ef] shadow-[0_4px_12px_rgba(0,0,0,0.02)] py-9 px-9 flex flex-col gap-5 origin-center"
      initial={{ opacity: 0, scale: 0.96 * fit }}
      animate={{ opacity: 1, scale: fit }}
      exit={{
        opacity: 0,
        scale: 0.96 * fit,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute top-6 right-6 p-2 text-[#666] hover:text-[#333] transition-colors rounded-full hover:bg-black/5"
        aria-label="Back to options"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {submitted ? (
        <SubmittedState />
      ) : (
        <>
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-[#6d8048] mb-1.5">
              Step {step} of 3
            </div>
            <h2 className="font-serif text-[26px] text-[#161616] font-semibold tracking-tight leading-tight">
              {step === 1
                ? "Join our buyers list"
                : step === 2
                ? "What you're looking for"
                : "Strategy & timeline"}
            </h2>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col gap-3.5 min-h-[340px]"
            >
              {step === 1 && (
                <>
                  <div>
                    <Lbl required>Name or company</Lbl>
                    <input
                      className={inputClass}
                      placeholder="Jane Doe / Acme Holdings LLC"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <Lbl required>Email</Lbl>
                      <input
                        className={inputClass}
                        type="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Lbl required>Phone</Lbl>
                      <input
                        className={inputClass}
                        type="tel"
                        placeholder="(206) 555-0142"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Lbl required>You are a…</Lbl>
                    <select
                      className={inputClass}
                      value={investorType}
                      onChange={(e) => setInvestorType(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {INVESTOR_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <Lbl required>Locations of interest</Lbl>
                    <input
                      className={inputClass}
                      placeholder="Seattle, Bellevue, Tacoma…"
                      value={locations}
                      onChange={(e) => setLocations(e.target.value)}
                    />
                  </div>
                  <div>
                    <Lbl required>Investment types</Lbl>
                    <MultiChips
                      options={INVESTMENT_TYPES}
                      values={investmentTypes}
                      onChange={setInvestmentTypes}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <Lbl required>Price range</Lbl>
                      <input
                        className={inputClass}
                        placeholder="$300K – $750K"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                      />
                    </div>
                    <div>
                      <Lbl>Min beds / baths</Lbl>
                      <input
                        className={inputClass}
                        placeholder="3 / 2"
                        value={bedsBaths}
                        onChange={(e) => setBedsBaths(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Lbl required>Financing</Lbl>
                    <MultiChips
                      options={FINANCING_TYPES}
                      values={financingTypes}
                      onChange={setFinancingTypes}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <Lbl>Property age</Lbl>
                      <input
                        className={inputClass}
                        placeholder="Any / pre-1970 / post-2000"
                        value={propertyAge}
                        onChange={(e) => setPropertyAge(e.target.value)}
                      />
                    </div>
                    <div>
                      <Lbl>Deal breakers</Lbl>
                      <input
                        className={inputClass}
                        placeholder="HOA, septic, etc."
                        value={dealBreakers}
                        onChange={(e) => setDealBreakers(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Lbl>Ideal condition</Lbl>
                    <MultiChips
                      options={IDEAL_CONDITIONS}
                      values={idealConditions}
                      onChange={setIdealConditions}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <Lbl>Investment strategy</Lbl>
                    <MultiChips
                      options={INVESTMENT_STRATEGIES}
                      values={investmentStrategies}
                      onChange={setInvestmentStrategies}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <Lbl>Properties this year</Lbl>
                      <input
                        className={inputClass}
                        placeholder="3-5"
                        value={propertiesPerYear}
                        onChange={(e) => setPropertiesPerYear(e.target.value)}
                      />
                    </div>
                    <div>
                      <Lbl required>Timeline to purchase</Lbl>
                      <select
                        className={inputClass}
                        value={timeline}
                        onChange={(e) => setTimeline(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {TIMELINES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Lbl>Anything else?</Lbl>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={3}
                      placeholder="Optional"
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                    />
                  </div>
                  <label className="flex items-start gap-2.5 mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#6d8048]"
                    />
                    <span className="font-sans text-[12px] text-[#666] leading-snug">
                      I consent to receive off-market deal alerts from BT
                      Investments.{" "}
                      <span className="text-[#a02e2e]">*</span>
                    </span>
                  </label>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {submitError && (
            <div className="font-sans text-[12px] text-red-700 bg-red-50 rounded-lg px-3 py-2 -mt-1">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <button
              type="button"
              onClick={() => {
                if (step === 1) onBack();
                else setStep((step - 1) as 1 | 2 | 3);
              }}
              className={secondaryBtn}
            >
              {step === 1 ? "Cancel" : "← Back"}
            </button>
            {step < 3 ? (
              <button
                type="button"
                disabled={step === 1 ? !canAdvance1 : !canAdvance2}
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                className={primaryBtn}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className={primaryBtn}
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

function SubmittedState() {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-3">
      <div className="w-12 h-12 rounded-full bg-[#6d8048]/15 flex items-center justify-center">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d8048"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="font-serif text-[24px] text-[#161616] font-semibold tracking-tight">
        You&apos;re on the list.
      </h2>
      <p className="font-sans text-[14px] text-[#555] max-w-[360px] leading-relaxed">
        We&apos;ll send off-market deals that match your criteria — first
        notice goes to people on this list before anything hits the public
        market.
      </p>
    </div>
  );
}
