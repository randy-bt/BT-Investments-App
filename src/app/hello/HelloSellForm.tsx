"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * HelloSellForm — multi-step seller intake rendered inside the Hello
 * portal card. Visually matches the portal aesthetic (cream card, serif
 * heading, white inputs, olive primary button) but captures the SAME
 * fields and submits to the SAME endpoint with the SAME form_name as
 * the marketing-site SellPropertyForm — so both entry experiences
 * land in the same Supabase row and trigger the same email.
 */

const PROPERTY_TYPES = [
  "Single Family",
  "Multi-Family (Duplex/Triplex/Fourplex)",
  "Condo",
  "Townhouse",
  "Mobile / Manufactured Home",
  "Land",
  "Other",
];

const CONDITIONS = [
  "Excellent — move-in ready",
  "Good — cosmetic updates needed",
  "Fair — some repairs needed",
  "Poor — major repairs needed",
  "Tear-down",
];

const OCCUPANCIES = ["Owner-occupied", "Tenant-occupied", "Vacant", "Other"];

const TIMELINES = [
  "ASAP (within 2 weeks)",
  "Within 30 days",
  "Within 60 days",
  "90+ days",
  "Flexible",
  "Just exploring",
];

const REASONS_FOR_SELLING = [
  "Relocating",
  "Inherited",
  "Divorce",
  "Financial hardship",
  "Downsizing",
  "Tired landlord",
  "Just exploring",
  "Other",
];

// Shared input/select styling for the Hello aesthetic.
const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[14px] focus:outline-none focus:border-[#999]";

const labelClass =
  "block font-sans text-[12px] font-medium text-[#555] mb-1.5 tracking-wide";

const primaryBtn =
  "px-5 py-2.5 rounded-full bg-[#6d8048] text-white font-sans text-[14px] font-medium hover:bg-[#5a6b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryBtn =
  "px-5 py-2.5 rounded-full bg-transparent text-[#666] font-sans text-[14px] font-medium hover:text-[#161616] transition-colors";

export function HelloSellForm({
  fit,
  onBack,
}: {
  fit: number;
  onBack: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — contact + property location
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");

  // Step 2 — property details
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [condition, setCondition] = useState("");
  const [occupancy, setOccupancy] = useState("");
  const [occupancyOther, setOccupancyOther] = useState("");
  const [currentRent, setCurrentRent] = useState("");
  const [renovations, setRenovations] = useState("");
  const [issues, setIssues] = useState("");

  // Step 3 — sale details
  const [timeline, setTimeline] = useState("");
  const [reasonForSelling, setReasonForSelling] = useState("");
  const [listedAgent, setListedAgent] = useState<"" | "yes" | "no">("");
  const [liens, setLiens] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [consent, setConsent] = useState(false);

  const canAdvance1 = !!(name && email && phone && street);
  const canAdvance2 = !!(
    propertyType &&
    occupancy &&
    (occupancy !== "Other" || occupancyOther)
  );
  const canSubmit = !!(timeline && listedAgent && askingPrice && consent);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const data: Record<string, string> = {};
    const set = (key: string, value: string) => {
      if (value && value.trim()) data[key] = value;
    };
    set("Name", name);
    set("Email", email);
    set("Phone", phone);
    set("Street", street);
    set("City", city);
    set("State", stateField);
    set("ZIP", zip);
    set("Property Type", propertyType);
    set("Bedrooms", bedrooms);
    set("Bathrooms", bathrooms);
    set("Condition", condition);
    set(
      "Occupancy",
      occupancy === "Other" && occupancyOther
        ? `Other — ${occupancyOther}`
        : occupancy
    );
    set("Current Rent", currentRent);
    set("Recent Renovations", renovations);
    set("Known Issues", issues);
    set("Timeline", timeline);
    set("Reason for Selling", reasonForSelling);
    set(
      "Currently Listed With Agent",
      listedAgent === "yes" ? "Yes" : listedAgent === "no" ? "No" : ""
    );
    set("Liens / Mortgages / Back Taxes", liens);
    set("Asking Price", askingPrice);
    set("Additional Info", additionalInfo);
    set("Consent", consent ? "Yes" : "No");

    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // SAME form_name as marketing SellPropertyForm — both surfaces
        // converge in the same row / email.
        body: JSON.stringify({
          form_name: "BT Investments - Sell Your Property",
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
          {/* Header — title + subtle step indicator */}
          <div>
            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-[#6d8048] mb-1.5">
              Step {step} of 3
            </div>
            <h2 className="font-serif text-[26px] text-[#161616] font-semibold tracking-tight leading-tight">
              {step === 1
                ? "Sell your property"
                : step === 2
                ? "Tell us about it"
                : "Sale details"}
            </h2>
          </div>

          {/* Form content — animates between steps */}
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
                    <label className={labelClass}>Name</label>
                    <input
                      className={inputClass}
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        className={inputClass}
                        type="email"
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
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
                    <label className={labelClass}>Property address</label>
                    <input
                      className={inputClass}
                      placeholder="123 Main St"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3.5">
                    <div className="col-span-1">
                      <label className={labelClass}>City</label>
                      <input
                        className={inputClass}
                        placeholder="Seattle"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelClass}>State</label>
                      <input
                        className={inputClass}
                        placeholder="WA"
                        value={stateField}
                        onChange={(e) => setStateField(e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className={labelClass}>ZIP</label>
                      <input
                        className={inputClass}
                        placeholder="98101"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className={labelClass}>Property type</label>
                    <select
                      className={inputClass}
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Bedrooms</label>
                      <input
                        className={inputClass}
                        placeholder="3"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Bathrooms</label>
                      <input
                        className={inputClass}
                        placeholder="2"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Condition</label>
                    <select
                      className={inputClass}
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Occupancy</label>
                      <select
                        className={inputClass}
                        value={occupancy}
                        onChange={(e) => setOccupancy(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {OCCUPANCIES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    {occupancy === "Tenant-occupied" && (
                      <div>
                        <label className={labelClass}>Current monthly rent</label>
                        <input
                          className={inputClass}
                          placeholder="$2,400"
                          value={currentRent}
                          onChange={(e) => setCurrentRent(e.target.value)}
                        />
                      </div>
                    )}
                    {occupancy === "Other" && (
                      <div>
                        <label className={labelClass}>Describe</label>
                        <input
                          className={inputClass}
                          placeholder="e.g. seasonal use"
                          value={occupancyOther}
                          onChange={(e) => setOccupancyOther(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Recent renovations</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder="New roof 2022, kitchen 2019…"
                      value={renovations}
                      onChange={(e) => setRenovations(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Known issues</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder="Foundation crack, leaky basement…"
                      value={issues}
                      onChange={(e) => setIssues(e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Timeline</label>
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
                    <div>
                      <label className={labelClass}>Reason for selling</label>
                      <select
                        className={inputClass}
                        value={reasonForSelling}
                        onChange={(e) => setReasonForSelling(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {REASONS_FOR_SELLING.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Currently listed with an agent?
                    </label>
                    <div className="flex gap-2">
                      {(["yes", "no"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setListedAgent(v)}
                          className={`px-4 py-2 rounded-full font-sans text-[13px] font-medium transition-colors ${
                            listedAgent === v
                              ? "bg-[#6d8048] text-white"
                              : "bg-white border border-[#ddd] text-[#555] hover:border-[#999]"
                          }`}
                        >
                          {v === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className={labelClass}>Asking price</label>
                      <input
                        className={inputClass}
                        placeholder="$450,000"
                        value={askingPrice}
                        onChange={(e) => setAskingPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Liens / mortgages / back taxes
                      </label>
                      <input
                        className={inputClass}
                        placeholder="Optional"
                        value={liens}
                        onChange={(e) => setLiens(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Anything else we should know?</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
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
                      I agree to be contacted by BT Investments about my
                      property. No spam, no obligation.
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

          {/* Nav row */}
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
        Thanks — we&apos;ll be in touch.
      </h2>
      <p className="font-sans text-[14px] text-[#555] max-w-[360px] leading-relaxed">
        We&apos;ll review your property and reach out within 24 hours with
        next steps and an offer range.
      </p>
    </div>
  );
}
