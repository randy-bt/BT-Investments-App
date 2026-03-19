"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvestor } from "@/actions/investors";

type PhoneRow = { phone_number: string; label: string; is_primary: boolean };
type EmailRow = { email: string; label: string; is_primary: boolean };

export function InvestorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [locationsOfInterest, setLocationsOfInterest] = useState("");
  const [dealsNotes, setDealsNotes] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await createInvestor({
        name,
        locations_of_interest: locationsOfInterest,
        company: company || undefined,
        deals_notes: dealsNotes || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
      });
      if (result.success) {
        router.push(`/app/dispositions/investor-record/${result.data.id}`);
      } else {
        setError(result.error);
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

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Investor Information
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
            <span className="text-xs text-neutral-500">Company</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-neutral-500">
            Locations of Interest *
          </span>
          <input
            value={locationsOfInterest}
            onChange={(e) => setLocationsOfInterest(e.target.value)}
            placeholder="e.g. Phoenix, AZ; Tucson, AZ"
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">Deals / Notes</span>
          <textarea
            value={dealsNotes}
            onChange={(e) => setDealsNotes(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
          />
        </label>
      </div>

      {/* Phones */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Phone Numbers</h3>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={phone.phone_number}
              onChange={(e) => {
                const next = [...phones];
                next[i] = { ...next[i], phone_number: e.target.value };
                setPhones(next);
              }}
              placeholder="Phone number"
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            />
            <button
              type="button"
              onClick={() => setPhones(phones.filter((_, j) => j !== i))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPhones([
              ...phones,
              {
                phone_number: "",
                label: "",
                is_primary: phones.length === 0,
              },
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
              placeholder="Email address"
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
              {
                email: "",
                label: "",
                is_primary: emails.length === 0,
              },
            ])
          }
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add email
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="rounded border border-neutral-400 bg-neutral-50 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Investor"}
      </button>
    </div>
  );
}
