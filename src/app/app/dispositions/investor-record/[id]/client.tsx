"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateInvestor,
  archiveInvestor,
  reopenInvestor,
  deleteInvestor,
} from "@/actions/investors";
import { ActivityFeed, type ActivityFeedHandle, type QuickAction } from "@/components/ActivityFeed";
import { QuoSmsDialog } from "@/components/QuoSmsDialog";
import { SendEmailDialog } from "@/components/SendEmailDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { FloatingIndicaButton } from "@/components/indica/FloatingIndicaButton";
import { LocationChipPicker } from "@/components/LocationChipPicker";
import { DealsSentPanel } from "@/components/DealsSentPanel";
import { formatDate } from "@/lib/format";
import type { InvestorWithRelations, Update, EntityStatus } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string; author_role?: string };

// "Sent text" / "Sent email" quick actions retired — the wired-up Quo SMS
// and Send Email buttons log real sends to the feed now.
const INVESTOR_QUICK_ACTIONS: QuickAction[] = [
  { label: "Called, no answer", content: "Called, no answer" },
  { label: "Left voicemail", content: "Left voicemail" },
];

// Loose email matcher for scanning Notes content for extra addresses.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function InvestorRecordClient({
  investor,
  updates,
  currentUserName,
}: {
  investor: InvestorWithRelations;
  updates: UpdateWithAuthor[];
  currentUserName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quoSmsOpen, setQuoSmsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const activityFeedRef = useRef<ActivityFeedHandle>(null);

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(investor.name);
  const [editCompany, setEditCompany] = useState(investor.company || "");
  const [editStatus, setEditStatus] = useState<EntityStatus>(investor.status);

  // Sync edit state when investor prop changes (e.g. after refresh)
  useEffect(() => {
    setEditName(investor.name);
    setEditCompany(investor.company || "");
    setEditStatus(investor.status);
  }, [investor]);

  function handleSave() {
    startTransition(async () => {
      const updates: Record<string, unknown> = {};
      const trimmedName = editName.trim() || investor.name;
      if (trimmedName !== investor.name) updates.name = trimmedName;
      if ((editCompany || null) !== (investor.company || null))
        updates.company = editCompany || null;
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
                  className="text-base font-bold tracking-tight font-editable border-b border-neutral-300 outline-none bg-transparent w-full"
                  placeholder="Investor name"
                />
              ) : (
                <h2 className="text-base font-bold tracking-tight font-editable">
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
              <LocationChipPicker
                investorId={investor.id}
                initialLocations={(investor.locations ?? [])
                  .map((il) => il.location)
                  .filter((l): l is NonNullable<typeof l> => !!l)}
                onChange={() => router.refresh()}
              />
            </dd>
          </div>
        </div>

        {/* Right: Deals Sent — auto-populated from deal sends */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <DealsSentPanel investorId={investor.id} />
        </div>
      </section>

      {/* Notes section — full width */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <ActivityFeed
          ref={activityFeedRef}
          entityType="investor"
          entityId={investor.id}
          entityName={investor.name}
          initialUpdates={updates}
          quickActions={INVESTOR_QUICK_ACTIONS}
          secondRowActions={[
            { label: "💬 Send SMS via Quo", onClick: () => setQuoSmsOpen(true), variant: "quo" },
            { label: "✉️ Send Email", onClick: () => setEmailOpen(true), variant: "grey" },
          ]}
        />
      </section>

      {quoSmsOpen && (
        <QuoSmsDialog
          recipientName={investor.name}
          phones={investor.phones.map((p) => p.phone_number)}
          entityType="investor"
          entityId={investor.id}
          onSent={(u) => activityFeedRef.current?.pushUpdate(u)}
          onClose={() => setQuoSmsOpen(false)}
        />
      )}

      {emailOpen && (
        <SendEmailDialog
          recipientName={investor.name}
          recipientEmail={primaryEmail?.email ?? null}
          suggestedEmails={[
            ...investor.emails.map((e) => e.email),
            ...updates.flatMap((u) => u.content.match(EMAIL_RE) ?? []),
          ]}
          entityType="investor"
          entityId={investor.id}
          onSent={(u) => activityFeedRef.current?.pushUpdate(u)}
          onClose={() => setEmailOpen(false)}
        />
      )}

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
      <FloatingIndicaButton
        entityType="investor"
        entityId={investor.id}
        currentUserName={currentUserName}
      />
    </div>
  );
}
