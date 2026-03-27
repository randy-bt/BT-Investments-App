"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/actions/leads";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type PhoneRow = { phone_number: string; label: string; is_primary: boolean };
type EmailRow = { email: string; label: string; is_primary: boolean };
type PropertyRow = { address: string };

export function LeadForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [dateConverted, setDateConverted] = useState("");
  const [sourceCampaign, setSourceCampaign] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [occupancyStatus, setOccupancyStatus] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [sellingTimeline, setSellingTimeline] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([
    { phone_number: "", label: "", is_primary: true },
  ]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([
    { address: "" },
  ]);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await createLead({
        name,
        date_converted: dateConverted,
        source_campaign_name: sourceCampaign,
        handoff_notes: handoffNotes,
        mailing_address: mailingAddress || undefined,
        occupancy_status: occupancyStatus || undefined,
        asking_price: askingPrice ? Number(askingPrice) : undefined,
        selling_timeline: sellingTimeline || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
        properties: properties.filter((p) => p.address.trim()),
      });
      if (result.success) {
        window.open(`/app/acquisitions/lead-record/${result.data.id}`, "_blank");
        router.push("/app/acquisitions");
      } else {
        setError("Please fill in all required fields before submitting.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Required fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Required Information
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Date Converted *</span>
            <input
              type="date"
              value={dateConverted}
              onChange={(e) => setDateConverted(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">
              Source Campaign *
            </span>
            <input
              value={sourceCampaign}
              onChange={(e) => setSourceCampaign(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-neutral-500">Handoff Notes *</span>
          <textarea
            value={handoffNotes}
            onChange={(e) => setHandoffNotes(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
          />
        </label>
      </div>

      {/* Optional fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Optional Details
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Mailing Address</span>
            <input
              value={mailingAddress}
              onChange={(e) => setMailingAddress(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Occupancy Status</span>
            <input
              value={occupancyStatus}
              onChange={(e) => setOccupancyStatus(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Asking Price</span>
            <input
              type="text"
              inputMode="numeric"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">
              Selling Timeline
            </span>
            <input
              value={sellingTimeline}
              onChange={(e) => setSellingTimeline(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
      </div>

      {/* Phones */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">
          Phone Numbers *
        </h3>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={phone.phone_number}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], phone_number: e.target.value };
                setPhones(next);
              }}
              placeholder=""
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <input
              value={phone.label}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], label: e.target.value };
                setPhones(next);
              }}
              placeholder="Label (optional)"
              className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm font-editable placeholder:text-[0.65rem] placeholder:text-neutral-300"
            />
            {phones.length > 1 && (
              <button
                type="button"
                onClick={() => setPhones(phones.filter((_, j) => j !== i))}
                className="text-xs text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPhones([
              ...phones,
              { phone_number: "", label: "", is_primary: false },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add phone
        </button>
      </div>

      {/* Emails */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Emails</h3>
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={email.email}
              onChange={(e) => {
                const next = [...emails];
                next[i] = { ...next[i], email: e.target.value };
                setEmails(next);
              }}
              placeholder=""
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <button
              type="button"
              onClick={() => setEmails(emails.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEmails([
              ...emails,
              { email: "", label: "", is_primary: emails.length === 0 },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add email
        </button>
      </div>

      {/* Properties */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Property Address *</h3>
        {properties.map((prop, i) => (
          <div key={i} className="flex gap-2">
            <AddressAutocomplete
              value={prop.address}
              onChange={(val) => {
                const next = [...properties];
                next[i] = { address: val };
                setProperties(next);
              }}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            {properties.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setProperties(properties.filter((_, j) => j !== i))
                }
                className="text-xs text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setProperties([...properties, { address: "" }])}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add property
        </button>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="rounded border border-neutral-400 bg-neutral-50 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Lead"}
      </button>
    </div>
  );
}
