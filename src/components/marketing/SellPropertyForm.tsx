"use client";

import { useState } from "react";
import { MarketingAddressInput } from "./MarketingAddressInput";
import {
  ProgressIndicator,
  SectionHeading,
  Callout,
  Field,
  FieldShell,
  SelectField,
  YesNoField,
  StepNav,
  fieldInputClass,
} from "./MarketingFormPrimitives";

/**
 * SellPropertyForm — multi-step intake form for /sell-property (CTA1).
 * Three steps: Contact & Property, Property Details, Sale Details.
 * Uses shared primitives from MarketingFormPrimitives.
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

const OCCUPANCIES = [
  "Owner-occupied",
  "Tenant-occupied",
  "Vacant",
  "Other",
];

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

const STEPS = [
  { n: 1, label: "Contact & Property" },
  { n: 2, label: "Property Details" },
  { n: 3, label: "Sale Details" },
];

export function SellPropertyForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");

  // Step 2
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [condition, setCondition] = useState("");
  const [occupancy, setOccupancy] = useState("");
  const [occupancyOther, setOccupancyOther] = useState("");
  const [currentRent, setCurrentRent] = useState("");
  const [renovations, setRenovations] = useState("");
  const [issues, setIssues] = useState("");

  // Step 3
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

  function goToStep(next: 1 | 2 | 3) {
    setStep(next);
    if (typeof window !== "undefined") {
      const formEl = document.getElementById("sell-property-form");
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

    // The /api/forms/submit endpoint expects all values as strings.
    // Build the data dict — drop empty fields so the email stays clean.
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
        body: JSON.stringify({
          form_name: "BT Investments - Sell Your Property",
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
        id="sell-property-form"
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
          Submitted
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
          Thank you — we&apos;ll be in touch within 24 hours.
        </h2>
        <p
          className="font-mkt-sans mt-4 max-w-xl mx-auto"
          style={{
            color: "var(--mkt-muted-light)",
            fontSize: "1rem",
            lineHeight: 1.55,
          }}
        >
          We&apos;ll review the details you shared, run our analysis, and reach
          out by phone or email with a no-obligation cash offer. If you have
          photos handy, please reply to our follow-up email with them — they
          help us tighten the offer.
        </p>
      </div>
    );
  }

  return (
    <form
      id="sell-property-form"
      onSubmit={handleSubmit}
      className="rounded-2xl p-6 sm:p-10 lg:p-12 scroll-mt-24"
      style={{
        background: "var(--mkt-cream-dim)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <ProgressIndicator step={step} steps={STEPS} />

      {/* Step 1 */}
      {step === 1 && (
        <div className="mt-8 space-y-6">
          <Callout>
            Heads up: the more accurate the info you give us, the more accurate
            (and often higher) our offer can be. Take a few minutes — it&apos;s
            worth it.
          </Callout>

          <SectionHeading>Contact</SectionHeading>
          <Field
            label="Name"
            placeholder="Whatever you'd like us to call you"
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

          <SectionHeading>Property Location</SectionHeading>
          <FieldShell label="Street Address" required>
            <MarketingAddressInput
              street={street}
              onStreetChange={setStreet}
              onSuggestionSelected={(c) => {
                setCity(c.city);
                setStateField(c.state);
                setZip(c.zip);
              }}
              placeholder="Start typing to see suggestions…"
              required
              className={fieldInputClass}
            />
          </FieldShell>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            <Field
              label="City"
              placeholder="Tacoma"
              value={city}
              onChange={setCity}
            />
            <Field
              label="State"
              placeholder="WA"
              value={stateField}
              onChange={setStateField}
            />
            <Field
              label="ZIP"
              placeholder="98401"
              value={zip}
              onChange={setZip}
            />
          </div>

          <StepNav
            onContinue={() => goToStep(2)}
            canContinue={canAdvance1}
            isFirst
          />
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="mt-8 space-y-6">
          <SectionHeading>Property Basics</SectionHeading>
          <SelectField
            label="Property Type"
            value={propertyType}
            onChange={setPropertyType}
            required
            options={PROPERTY_TYPES}
            placeholder="Select one"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <Field
              label="Bedrooms"
              placeholder="3"
              value={bedrooms}
              onChange={setBedrooms}
            />
            <Field
              label="Bathrooms"
              placeholder="2.5"
              value={bathrooms}
              onChange={setBathrooms}
            />
          </div>

          <SectionHeading>Condition & Occupancy</SectionHeading>
          <SelectField
            label="Condition"
            value={condition}
            onChange={setCondition}
            options={CONDITIONS}
            placeholder="Select one"
          />
          <SelectField
            label="Occupancy"
            value={occupancy}
            onChange={(val) => {
              setOccupancy(val);
              if (val !== "Other") setOccupancyOther("");
            }}
            required
            options={OCCUPANCIES}
            placeholder="Select one"
          />
          {occupancy === "Other" && (
            <Field
              label="Please explain"
              placeholder="Tell us about the occupancy situation"
              value={occupancyOther}
              onChange={setOccupancyOther}
              required
            />
          )}
          <Field
            label="Current rent (if applicable)"
            placeholder="e.g. $1,800/mo"
            value={currentRent}
            onChange={setCurrentRent}
          />
          <Field
            label="Recent renovations or upgrades"
            placeholder="New roof in 2022, kitchen remodeled in 2019, etc."
            value={renovations}
            onChange={setRenovations}
            multiline
          />
          <Field
            label="Known issues, repairs needed, or other concerns"
            placeholder="Furnace nearing end of life, foundation crack in basement, etc."
            value={issues}
            onChange={setIssues}
            multiline
          />

          <StepNav
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
            canContinue={canAdvance2}
          />
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="mt-8 space-y-6">
          <SectionHeading>Sale Details</SectionHeading>
          <SelectField
            label="When do you want to sell"
            value={timeline}
            onChange={setTimeline}
            required
            options={TIMELINES}
            placeholder="Select one"
          />
          <SelectField
            label="Reason for selling"
            value={reasonForSelling}
            onChange={setReasonForSelling}
            options={REASONS_FOR_SELLING}
            placeholder="Select one"
          />
          <YesNoField
            label="Currently listed with an agent?"
            value={listedAgent}
            onChange={setListedAgent}
            required
          />
          <Field
            label="Outstanding mortgages, liens, or back taxes?"
            placeholder="If yes, share the amounts and details"
            value={liens}
            onChange={setLiens}
            multiline
          />
          <Field
            label="Your asking price"
            placeholder="A specific number or 'Open to offer'"
            value={askingPrice}
            onChange={setAskingPrice}
            required
          />
          <Field
            label="Additional info"
            placeholder="Anything else we should know"
            value={additionalInfo}
            onChange={setAdditionalInfo}
            multiline
          />

          <Callout>
            Last chance — anything you add to the additional info field
            directly affects the strength of our offer. Don&apos;t hold back.
          </Callout>

          <label
            className="flex items-start gap-3 font-mkt-sans text-sm"
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
              I agree it&apos;s okay for BT Investments to contact me about
              this property by phone, text, or email.{" "}
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
            submitLabel={submitting ? "Submitting…" : "Submit"}
          />
        </div>
      )}
    </form>
  );
}
