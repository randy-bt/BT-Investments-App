"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  archiveInvestor,
  reopenInvestor,
  addInvestorPhone,
  removeInvestorPhone,
  addInvestorEmail,
  removeInvestorEmail,
} from "@/actions/investors";
import { PhoneEmailList } from "@/components/PhoneEmailList";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { InvestorWithRelations, Update } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

export function InvestorRecordClient({
  investor,
  updates,
}: {
  investor: InvestorWithRelations;
  updates: UpdateWithAuthor[];
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchive, setShowArchive] = useState(false);

  function handleArchive() {
    startTransition(async () => {
      await archiveInvestor(investor.id);
      setShowArchive(false);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenInvestor(investor.id);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
      {/* Left column */}
      <div className="space-y-6">
        {/* Investor details */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">
            Investor Details
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">Locations of Interest</dt>
              <dd className="font-editable">
                {investor.locations_of_interest}
              </dd>
            </div>
            {investor.deals_notes && (
              <div>
                <dt className="text-neutral-500">Deals / Notes</dt>
                <dd className="font-editable whitespace-pre-wrap rounded border border-dashed border-neutral-200 p-2 bg-neutral-50">
                  {investor.deals_notes}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Contact info */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">
            Contact Info
          </h2>
          <PhoneEmailList
            phones={investor.phones}
            emails={investor.emails}
            onAddPhone={async (data) => {
              await addInvestorPhone(investor.id, data);
              router.refresh();
            }}
            onRemovePhone={async (phoneId) => {
              await removeInvestorPhone(phoneId);
              router.refresh();
            }}
            onAddEmail={async (data) => {
              await addInvestorEmail(investor.id, data);
              router.refresh();
            }}
            onRemoveEmail={async (emailId) => {
              await removeInvestorEmail(emailId);
              router.refresh();
            }}
          />
        </div>

        {/* Activity feed */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <ActivityFeed
            entityType="investor"
            entityId={investor.id}
            initialUpdates={updates}
          />
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">Actions</h2>

          {isAdmin && (
            <>
              {investor.status === "active" ? (
                <button
                  type="button"
                  onClick={() => setShowArchive(true)}
                  disabled={isPending}
                  className="w-full rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  Archive Investor
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReopen}
                  disabled={isPending}
                  className="w-full rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
                >
                  Reopen Investor
                </button>
              )}
            </>
          )}

          {!isAdmin && (
            <p className="text-xs text-neutral-400">
              Archiving and reopening require admin access.
            </p>
          )}

          <ConfirmDialog
            open={showArchive}
            title="Archive Investor"
            message="This will mark the investor as closed. You can reopen them later."
            confirmLabel="Archive"
            onConfirm={handleArchive}
            onCancel={() => setShowArchive(false)}
          />
        </div>
      </div>
    </section>
  );
}
