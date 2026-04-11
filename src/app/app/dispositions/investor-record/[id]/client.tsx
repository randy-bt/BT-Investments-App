"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateInvestor,
  archiveInvestor,
  reopenInvestor,
  deleteInvestor,
  addInvestorLocation,
  removeInvestorLocation,
} from "@/actions/investors";
import { ActivityFeed, type QuickAction } from "@/components/ActivityFeed";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { InvestorWithRelations, Update, EntityStatus } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string; author_role?: string };

const INVESTOR_QUICK_ACTIONS: QuickAction[] = [
  { label: "Called, no answer", content: "Called, no answer" },
  { label: "Left voicemail", content: "Left voicemail" },
  { label: "Sent text", content: "Sent text" },
  { label: "Sent email", content: "Sent email" },
];

export function InvestorRecordClient({
  investor,
  updates,
}: {
  investor: InvestorWithRelations;
  updates: UpdateWithAuthor[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(investor.name);
  const [editCompany, setEditCompany] = useState(investor.company || "");
  const [editDealsNotes, setEditDealsNotes] = useState(
    investor.deals_notes || ""
  );
  const [editStatus, setEditStatus] = useState<EntityStatus>(investor.status);

  // Sync edit state when investor prop changes (e.g. after refresh)
  useEffect(() => {
    setEditName(investor.name);
    setEditCompany(investor.company || "");
    setEditDealsNotes(investor.deals_notes || "");
    setEditStatus(investor.status);
  }, [investor]);

  // Location tag input
  const [locationInput, setLocationInput] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const locationRef = useRef<HTMLInputElement>(null);

  // Auto-migrate locations_of_interest text into investor_locations tags
  const migrated = useRef(false);
  useEffect(() => {
    if (
      migrated.current ||
      investor.locations.length > 0 ||
      !investor.locations_of_interest?.trim()
    )
      return;
    migrated.current = true;

    const parts = investor.locations_of_interest
      .split(/[;,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    (async () => {
      for (const name of parts) {
        await addInvestorLocation(investor.id, name);
      }
      router.refresh();
    })();
  }, [investor.locations, investor.locations_of_interest, investor.id, router]);

  function handleSave() {
    startTransition(async () => {
      const updates: Record<string, unknown> = {};
      const trimmedName = editName.trim() || investor.name;
      if (trimmedName !== investor.name) updates.name = trimmedName;
      if ((editCompany || null) !== (investor.company || null))
        updates.company = editCompany || null;
      if ((editDealsNotes || null) !== (investor.deals_notes || null))
        updates.deals_notes = editDealsNotes || null;
      if (editStatus !== investor.status) updates.status = editStatus;

      if (Object.keys(updates).length > 0) {
        const result = await updateInvestor(investor.id, updates);
        if (!result.success) {
          alert("Could not save: " + result.error);
          return;
        }
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleAddLocation() {
    const name = locationInput.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await addInvestorLocation(investor.id, name);
      if (!result.success) {
        alert(result.error);
        return;
      }
      setLocationInput("");
      router.refresh();
    });
  }

  function handleRemoveLocation(locationId: string) {
    startTransition(async () => {
      await removeInvestorLocation(locationId);
      router.refresh();
    });
  }

  const isArchived = investor.status === "archived";

  function handleArchive() {
    startTransition(async () => {
      await archiveInvestor(investor.id);
      setShowArchiveConfirm(false);
      // Try to close the tab; if browser blocks it, redirect instead
      window.close();
      setTimeout(() => router.push("/app/dispositions"), 200);
    });
  }

  function handleUnarchive() {
    startTransition(async () => {
      await reopenInvestor(investor.id);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInvestor(investor.id);
      if (result.success) {
        setShowDeleteConfirm(false);
        router.push("/app/dispositions");
      }
    });
  }

  const primaryPhone = investor.phones[0];
  const primaryEmail = investor.emails[0];

  return (
    <div className="space-y-6">
      {/* Top row: Investor Details (left) + Deals Sent (right) — always side by side */}
      <section className="grid grid-cols-[1fr_2fr] gap-6">
        {/* Left: Investor Details */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-5 pt-3 pb-2 shadow-sm space-y-1.5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-base font-semibold tracking-tight font-editable border-b border-neutral-300 outline-none bg-transparent w-full"
                  placeholder="Investor name"
                />
              ) : (
                <h2 className="text-base font-semibold tracking-tight font-editable">
                  {investor.name}
                </h2>
              )}
              <p
                className="text-neutral-400 mt-0.5"
                style={{ fontSize: "0.55rem" }}
              >
                First Contact: {formatDate(investor.created_at)}
              </p>
            </div>
            {editing ? (
              <div className="flex gap-2 ml-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={isPending}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-white hover:bg-neutral-700"
                >
                  {isPending ? "Saving..." : "Save"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50 ml-2 shrink-0"
              >
                Edit
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-sm">
            <div>
              <dt className="text-neutral-500 text-xs">Phone</dt>
              <dd className="font-editable text-sm">
                {primaryPhone ? primaryPhone.phone_number : "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Email</dt>
              <dd className="font-editable text-sm">
                {primaryEmail ? primaryEmail.email : "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Company</dt>
              <dd className="font-editable text-sm">
                {editing ? (
                  <input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    placeholder="Company name"
                  />
                ) : (
                  investor.company || "\u2014"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500 text-xs">Status</dt>
              <dd>
                {editing ? (
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as EntityStatus)
                    }
                    className="rounded border border-neutral-200 px-1 py-0.5 text-xs font-editable"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                ) : (
                  <StatusBadge status={investor.status} small />
                )}
              </dd>
            </div>
          </div>

          {/* Locations of Interest */}
          <div className="mt-1">
            <dt className="text-neutral-500 text-xs mb-1">
              Locations of Interest
            </dt>
            <dd>
              <div className="flex flex-wrap items-center gap-1">
                {investor.locations.map((loc) => (
                  <span
                    key={loc.id}
                    className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-px text-[0.65rem] text-neutral-700 font-editable"
                  >
                    {loc.location_name}
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc.id)}
                      disabled={isPending}
                      className="ml-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-50"
                      title="Remove location"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-2.5 w-2.5"
                      >
                        <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
                      </svg>
                    </button>
                  </span>
                ))}
                {investor.locations.length === 0 && !showLocationInput && (
                  <span className="text-xs text-neutral-400">
                    No locations
                  </span>
                )}
                {showLocationInput ? (
                  <div className="inline-flex items-center gap-1">
                    <input
                      ref={locationRef}
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddLocation();
                        }
                        if (e.key === "Escape") {
                          setShowLocationInput(false);
                          setLocationInput("");
                        }
                      }}
                      onBlur={() => {
                        if (!locationInput.trim()) {
                          setShowLocationInput(false);
                        }
                      }}
                      autoFocus
                      className="w-36 rounded border border-neutral-200 px-2 py-0.5 text-xs font-editable"
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={handleAddLocation}
                      disabled={isPending || !locationInput.trim()}
                      className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLocationInput(true)}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 text-xs leading-none"
                    title="Add location"
                  >
                    +
                  </button>
                )}
              </div>
            </dd>
          </div>
        </div>

        {/* Right: Deals Sent — always editable */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-medium text-neutral-500">Deals Sent</h2>
          <textarea
            value={editDealsNotes}
            onChange={(e) => setEditDealsNotes(e.target.value)}
            onBlur={() => {
              if ((editDealsNotes || null) !== (investor.deals_notes || null)) {
                startTransition(async () => {
                  await updateInvestor(investor.id, {
                    deals_notes: editDealsNotes || null,
                  });
                  router.refresh();
                });
              }
            }}
            rows={10}
            className="w-full rounded border border-dashed border-neutral-200 p-2 bg-neutral-50 text-sm font-editable placeholder:text-neutral-300 resize-y"
            placeholder="Track deals sent to this investor..."
          />
        </div>
      </section>

      {/* Notes section — full width */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <ActivityFeed
          entityType="investor"
          entityId={investor.id}
          entityName={investor.name}
          initialUpdates={updates}
          quickActions={INVESTOR_QUICK_ACTIONS}
        />
      </section>

      {/* Archive/Unarchive + Delete buttons */}
      <div className="-mt-2 flex flex-col items-start gap-1 pb-4">
        {isArchived ? (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={isPending}
            className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            {isPending ? "Unarchiving..." : "Unarchive Investor"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={isPending}
            className="rounded-md bg-[#6b1c2a] px-3 py-1.5 text-sm text-white hover:bg-[#5a1724] disabled:opacity-50"
          >
            Archive Investor
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPending}
          className="text-[0.65rem] text-neutral-400 hover:text-red-500 hover:underline disabled:opacity-50 ml-1"
        >
          Delete Investor
        </button>
      </div>

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-white px-8 py-6 shadow-lg max-w-md w-full mx-4 text-center">
            <p className="text-lg text-neutral-700">
              Are you sure you want to archive this investor?
            </p>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(false)}
              className="rounded-md bg-neutral-800 px-5 py-2 text-base text-white hover:bg-neutral-700 mt-4"
            >
              Go Back
            </button>
            <br />
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="text-neutral-400 underline hover:text-neutral-600 disabled:opacity-50 mt-1.5 inline-block"
              style={{ fontSize: "0.7rem" }}
            >
              {isPending ? "Archiving..." : "Archive Investor"}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-white px-8 py-6 shadow-lg max-w-md w-full mx-4 text-center">
            <p className="text-lg text-neutral-700">
              Are you sure you want to permanently delete this investor?
            </p>
            <p className="text-sm text-neutral-400 mt-1">
              This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md bg-neutral-800 px-5 py-2 text-base text-white hover:bg-neutral-700 mt-4"
            >
              Go Back
            </button>
            <br />
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-400 underline hover:text-red-600 disabled:opacity-50 mt-1.5 inline-block"
              style={{ fontSize: "0.7rem" }}
            >
              {isPending ? "Deleting..." : "Delete Investor"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
