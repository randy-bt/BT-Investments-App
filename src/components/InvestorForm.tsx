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

  // Tag-style locations
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");

  const [handoffNotes, setHandoffNotes] = useState("");

  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);

  function addLocation() {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    if (locations.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setLocationInput("");
      return;
    }
    setLocations([...locations, trimmed]);
    setLocationInput("");
  }

  function removeLocation(index: number) {
    setLocations(locations.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (locations.length === 0) {
      setError("At least one location of interest is required");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await createInvestor({
        name,
        locations_of_interest: locations.join(", "),
        company: company || undefined,
        handoff_notes: handoffNotes.trim() || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
      });
      if (result.success) {
        window.open(
          `/app/dispositions/investor-record/${result.data.id}`,
          "_blank"
        );
        router.push("/app/dispositions");
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

        {/* Tag-style locations */}
        <div>
          <span className="text-xs text-neutral-500">
            Locations of Interest *
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {locations.map((loc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 font-editable"
              >
                {loc}
                <button
                  type="button"
                  onClick={() => removeLocation(i)}
                  className="ml-0.5 text-neutral-400 hover:text-neutral-600"
                  title="Remove"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-3 w-3"
                  >
                    <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLocation();
                }
              }}
              placeholder="Type a city, county, or region and press Enter..."
              className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={addLocation}
              disabled={!locationInput.trim()}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Handoff Notes */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Handoff Notes</h3>
        <textarea
          value={handoffNotes}
          onChange={(e) => setHandoffNotes(e.target.value)}
          rows={4}
          placeholder="Initial notes about this investor..."
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable placeholder:text-neutral-400 resize-y"
        />
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
