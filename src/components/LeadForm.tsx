"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/actions/leads";
import { createUpdate } from "@/actions/updates";
import { getUploadUrl, createAttachmentRecord } from "@/actions/attachments";
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

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        asking_price: askingPrice || undefined,
        selling_timeline: sellingTimeline || undefined,
        phones: phones.filter((p) => p.phone_number.trim()),
        emails: emails.filter((e) => e.email.trim()),
        properties: properties.filter((p) => p.address.trim()),
      });
      if (result.success) {
        // Upload any pending files to the new lead
        if (pendingFiles.length > 0) {
          try {
            const updateResult = await createUpdate({
              entity_type: "lead",
              entity_id: result.data.id,
              content: `[${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} attached]`,
            });
            if (updateResult.success) {
              const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;
              for (const file of pendingFiles) {
                try {
                  if (file.size > DIRECT_UPLOAD_THRESHOLD) {
                    const urlResult = await getUploadUrl(updateResult.data.id, "lead", result.data.id, file.name, file.size);
                    if (urlResult.success) {
                      const uploadRes = await fetch(urlResult.data.signedUrl, {
                        method: "PUT",
                        headers: { "Content-Type": file.type || "application/octet-stream" },
                        body: file,
                      });
                      if (uploadRes.ok) {
                        await createAttachmentRecord(updateResult.data.id, file.name, file.type || "application/octet-stream", file.size, urlResult.data.path);
                      }
                    }
                  } else {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("updateId", updateResult.data.id);
                    formData.append("entityType", "lead");
                    formData.append("entityId", result.data.id);
                    await fetch("/api/attachments/upload", { method: "POST", body: formData });
                  }
                } catch {
                  // Continue with other files if one fails
                }
              }
            }
          } catch {
            // Lead was created successfully, file upload is best-effort
          }
        }
        window.open(`/app/acquisitions/lead-record/${result.data.id}`, "_blank");
        router.push("/app/acquisitions");
      } else {
        setError(result.error || "Something went wrong. Please try again.");
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

      {/* Lead Information — Name, Address, Phone, Source Campaign, Date Converted */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Lead Information
        </h3>
        <label className="block">
          <span className="text-xs text-neutral-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
          />
        </label>

        {/* Property Address */}
        <div className="space-y-2">
          <span className="text-xs text-neutral-500">Property Address</span>
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

        {/* Phone Numbers */}
        <div className="space-y-2">
          <span className="text-xs text-neutral-500">Phone Numbers</span>
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

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-neutral-500">Source Campaign</span>
            <input
              value={sourceCampaign}
              onChange={(e) => setSourceCampaign(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
          <label className="block">
            <span className="text-xs text-neutral-500">Date Converted</span>
            <input
              type="date"
              value={dateConverted}
              onChange={(e) => setDateConverted(e.target.value)}
              className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable"
            />
          </label>
        </div>
      </div>

      {/* Handoff Notes */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-neutral-500">Handoff Notes</span>
          <textarea
            value={handoffNotes}
            onChange={(e) => setHandoffNotes(e.target.value)}
            rows={3}
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
          />
        </label>
      </div>

      {/* Additional details */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-700">
          Additional Details
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

      {/* File Attachments */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-neutral-700">Attachments</h3>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              const selected = Array.from(e.target.files);
              setPendingFiles((prev) => [...prev, ...selected]);
              e.target.value = "";
            }
          }}
        />
        {pendingFiles.length > 0 && (
          <ul className="space-y-1">
            {pendingFiles.map((file, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-2 text-red-400 hover:text-red-600 shrink-0"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          + Add file
        </button>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-2 text-sm font-medium hover:bg-[#dce3cb] disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Lead"}
        </button>
      </div>
    </div>
  );
}
