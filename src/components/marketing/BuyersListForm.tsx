"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ProgressIndicator,
  SectionHeading,
  Field,
  SelectField,
  MultiSelectField,
  StepNav,
} from "./MarketingFormPrimitives";

/**
 * BuyersListForm — multi-step intake for /join-buyers-list (CTA2).
 * Three steps: Contact, Criteria, Strategy.
 *
 * Pre-fills name / email / phone from URL params written by the
 * homepage CTA2 short form. User can still edit any pre-filled value
 * before continuing.
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

const STEPS = [
  { n: 1, label: "Contact" },
  { n: 2, label: "Criteria" },
  { n: 3, label: "Strategy" },
];

export function BuyersListForm() {
  const params = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — pre-filled from CTA2 short form
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
  const [investmentStrategies, setInvestmentStrategies] = useState<string[]>([]);
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

  function goToStep(next: 1 | 2 | 3) {
    setStep(next);
    if (typeof window !== "undefined") {
      const formEl = document.getElementById("buyers-list-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    // /api/forms/submit expects all values as strings. Multi-selects
    // are joined with commas so the email reads as a single line.
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
        body: JSON.stringify({
          form_name: "BT Investments - Join Buyers List",
          data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(
          body?.error ?? "Submission failed. Please try again."
        );
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Submission failed. Please check your connection.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        id="buyers-list-form"
        className="rounded-2xl p-8 sm:p-12 text-center"
        style={{
          background: "var(--mkt-cream-dim)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="font-mkt-sans uppercase tracking-[0.32em] text-xs"
          style={{ color: "var(--mkt-olive)" }}
        >
          You&apos;re on the list
        </div>
        <h2
          className="font-mkt-display mt-4"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.1,
            fontWeight: 700,
            color: "var(--mkt-text-on-light)",
          }}
        >
          Welcome to the buyers list.
        </h2>
        <p
          className="font-mkt-sans mt-4 max-w-xl mx-auto"
          style={{
            color: "var(--mkt-muted-light)",
            fontSize: "1rem",
            lineHeight: 1.55,
          }}
        >
          We&apos;ll start sending deals that match your criteria. If we have
          something that fits before our next batch, expect an email or call
          from us shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      id="buyers-list-form"
      onSubmit={handleSubmit}
      className="rounded-2xl p-6 sm:p-10 lg:p-12 scroll-mt-24"
      style={{
        background: "var(--mkt-cream-dim)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <ProgressIndicator step={step} steps={STEPS} />

      {/* Step 1 — Contact */}
      {step === 1 && (
        <div className="mt-8 space-y-6">
          <p
            className="font-mkt-sans italic text-center"
            style={{
              color: "var(--mkt-muted-light)",
              fontSize: "0.85rem",
              lineHeight: 1.4,
            }}
          >
            The more specific you are, the better the deals we&apos;ll send.
          </p>

          <SectionHeading>Contact</SectionHeading>
          <Field
            label="Name / Company"
            placeholder="Jane Doe"
            value={name}
            onChange={setName}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              label="Phone"
              type="tel"
              placeholder="(206) 555-0142"
              value={phone}
              onChange={setPhone}
              required
            />
          </div>
          <SelectField
            label="Are you an investor, agent, or wholesaler?"
            value={investorType}
            onChange={setInvestorType}
            required
            options={INVESTOR_TYPES}
            placeholder="Select one"
          />

          <StepNav
            onContinue={() => goToStep(2)}
            canContinue={canAdvance1}
            isFirst
          />
        </div>
      )}

      {/* Step 2 — Criteria */}
      {step === 2 && (
        <div className="mt-8 space-y-6">
          <SectionHeading>What you&apos;re looking for</SectionHeading>
          <Field
            label="Locations Interested"
            placeholder="Tacoma, Seattle, South Sound, specific neighborhoods or ZIPs welcome"
            value={locations}
            onChange={setLocations}
            required
            multiline
          />
          <MultiSelectField
            label="Type of Investments"
            values={investmentTypes}
            onChange={setInvestmentTypes}
            options={INVESTMENT_TYPES}
            required
            helpText="Select all that apply"
          />
          <Field
            label="Price Range"
            placeholder="e.g. $250k–$500k, or 'up to $400k'"
            value={priceRange}
            onChange={setPriceRange}
            required
          />
          <MultiSelectField
            label="Type of Financing"
            values={financingTypes}
            onChange={setFinancingTypes}
            options={FINANCING_TYPES}
            required
            helpText="Select all that apply"
          />
          <Field
            label="Minimum Bedrooms / Bathrooms"
            placeholder="e.g. 3 beds, 2 baths, or '2+ / 1.5+'"
            value={bedsBaths}
            onChange={setBedsBaths}
          />
          <Field
            label="Preferred Property Age"
            placeholder="e.g. 'Built 1990 or newer', 'no preference', 'historic only'"
            value={propertyAge}
            onChange={setPropertyAge}
          />
          <MultiSelectField
            label="Ideal Condition"
            values={idealConditions}
            onChange={setIdealConditions}
            options={IDEAL_CONDITIONS}
            helpText="Select all that apply"
          />
          <Field
            label="Any deal breakers?"
            placeholder="e.g. no flood zones, no HOAs, no septic, etc."
            value={dealBreakers}
            onChange={setDealBreakers}
            multiline
          />

          <StepNav
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
            canContinue={canAdvance2}
          />
        </div>
      )}

      {/* Step 3 — Strategy */}
      {step === 3 && (
        <div className="mt-8 space-y-6">
          <SectionHeading>Your Strategy</SectionHeading>
          <MultiSelectField
            label="Investment Strategy"
            values={investmentStrategies}
            onChange={setInvestmentStrategies}
            options={INVESTMENT_STRATEGIES}
            helpText="Select all that apply"
          />
          <Field
            label="How many properties are you buying this year?"
            placeholder="e.g. '1', '2-5', 'as many as I can find'"
            value={propertiesPerYear}
            onChange={setPropertiesPerYear}
          />
          <SelectField
            label="Timeline to Purchase"
            value={timeline}
            onChange={setTimeline}
            required
            options={TIMELINES}
            placeholder="Select one"
          />
          <Field
            label="Additional Info"
            placeholder="Anything else we should know about your goals or preferences"
            value={additionalInfo}
            onChange={setAdditionalInfo}
            multiline
          />

          <label
            className="flex items-start gap-3 font-mkt-sans text-sm font-medium"
            style={{ color: "var(--mkt-text-on-light)" }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="mt-1 shrink-0"
            />
            <span>
              I consent to receive deal alerts and communications from BT
              Investments by phone, text, or email.{" "}
              <span style={{ color: "var(--mkt-olive)" }}>*</span>
            </span>
          </label>

          {submitError && (
            <div
              className="rounded-lg p-3 font-mkt-sans text-sm"
              style={{
                background: "rgba(180, 60, 60, 0.08)",
                color: "#a02e2e",
                border: "1px solid rgba(180, 60, 60, 0.25)",
              }}
            >
              {submitError}
            </div>
          )}
          <StepNav
            onBack={() => goToStep(2)}
            isLast
            canSubmit={canSubmit && !submitting}
            submitLabel={submitting ? "Submitting…" : "Join the Buyers List"}
          />
        </div>
      )}
    </form>
  );
}
