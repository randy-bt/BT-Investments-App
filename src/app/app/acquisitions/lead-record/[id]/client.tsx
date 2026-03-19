"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  archiveLead,
  reopenLead,
  changeLeadStage,
  addLeadPhone,
  removeLeadPhone,
  addLeadEmail,
  removeLeadEmail,
} from "@/actions/leads";
import { updateProperty } from "@/actions/properties";
import { PhoneEmailList } from "@/components/PhoneEmailList";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PropertyCard } from "@/components/PropertyCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { LeadWithRelations, LeadStage, Update } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

export function LeadRecordClient({
  lead,
  updates,
}: {
  lead: LeadWithRelations;
  updates: UpdateWithAuthor[];
}) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showArchive, setShowArchive] = useState(false);

  function handleStageChange(stage: LeadStage) {
    startTransition(async () => {
      await changeLeadStage(lead.id, { stage });
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveLead(lead.id);
      setShowArchive(false);
      router.refresh();
    });
  }

  function handleReopen() {
    startTransition(async () => {
      await reopenLead(lead.id);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
      {/* Left column */}
      <div className="space-y-6">
        {/* Lead details */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">
            Lead Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">Campaign</dt>
              <dd className="font-editable">
                {lead.source_campaign_name || "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Date Converted</dt>
              <dd className="font-editable">
                {lead.date_converted || "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Mailing Address</dt>
              <dd className="font-editable">
                {lead.mailing_address || "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Occupancy</dt>
              <dd className="font-editable">
                {lead.occupancy_status || "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Asking Price</dt>
              <dd className="font-editable">
                {lead.asking_price
                  ? `$${lead.asking_price.toLocaleString()}`
                  : "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Selling Timeline</dt>
              <dd className="font-editable">
                {lead.selling_timeline || "\u2014"}
              </dd>
            </div>
          </dl>
          {lead.handoff_notes && (
            <div>
              <dt className="text-xs text-neutral-500 mb-1">Handoff Notes</dt>
              <dd className="text-sm font-editable whitespace-pre-wrap rounded border border-dashed border-neutral-200 p-2 bg-neutral-50">
                {lead.handoff_notes}
              </dd>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">
            Contact Info
          </h2>
          <PhoneEmailList
            phones={lead.phones}
            emails={lead.emails}
            onAddPhone={async (data) => {
              await addLeadPhone(lead.id, data);
              router.refresh();
            }}
            onRemovePhone={async (phoneId) => {
              await removeLeadPhone(phoneId);
              router.refresh();
            }}
            onAddEmail={async (data) => {
              await addLeadEmail(lead.id, data);
              router.refresh();
            }}
            onRemoveEmail={async (emailId) => {
              await removeLeadEmail(emailId);
              router.refresh();
            }}
          />
        </div>

        {/* Properties */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">Properties</h2>
          {lead.properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onPopulate={async (propertyId) => {
                const res = await fetch("/api/properties/scrape", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    propertyId,
                    address: property.address,
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.data) {
                    await updateProperty(propertyId, data.data);
                    router.refresh();
                  }
                }
              }}
            />
          ))}
          {lead.properties.length === 0 && (
            <p className="text-xs text-neutral-400">No properties</p>
          )}
        </div>

        {/* Activity feed */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <ActivityFeed
            entityType="lead"
            entityId={lead.id}
            initialUpdates={updates}
          />
        </div>
      </div>

      {/* Right column — Actions */}
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">Actions</h2>

          {isAdmin && (
            <>
              <div>
                <label className="text-xs text-neutral-500">
                  Change Stage
                </label>
                <select
                  value={lead.stage}
                  onChange={(e) =>
                    handleStageChange(e.target.value as LeadStage)
                  }
                  disabled={isPending}
                  className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  <option value="follow_up">Follow Up</option>
                  <option value="lead">Lead</option>
                  <option value="marketing_on_hold">Marketing On Hold</option>
                  <option value="marketing_active">Marketing Active</option>
                  <option value="assigned_in_escrow">
                    Assigned / In Escrow
                  </option>
                </select>
              </div>

              {lead.status === "active" ? (
                <button
                  type="button"
                  onClick={() => setShowArchive(true)}
                  disabled={isPending}
                  className="w-full rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  Archive Lead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReopen}
                  disabled={isPending}
                  className="w-full rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
                >
                  Reopen Lead
                </button>
              )}
            </>
          )}

          {!isAdmin && (
            <p className="text-xs text-neutral-400">
              Stage changes and archiving require admin access.
            </p>
          )}

          <ConfirmDialog
            open={showArchive}
            title="Archive Lead"
            message="This will mark the lead as closed. You can reopen it later."
            confirmLabel="Archive"
            onConfirm={handleArchive}
            onCancel={() => setShowArchive(false)}
          />
        </div>
      </div>
    </section>
  );
}
