"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLead,
  addLeadPhone,
  removeLeadPhone,
  addLeadEmail,
  removeLeadEmail,
} from "@/actions/leads";
import { updateProperty } from "@/actions/properties";
import { ActivityFeed, type HashtagField } from "@/components/ActivityFeed";
import { PropertyCard } from "@/components/PropertyCard";
import { formatDate } from "@/lib/format";
import type { LeadWithRelations, Update } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

const LEAD_HASHTAG_FIELDS: HashtagField[] = [
  { key: "email", label: "Email", type: "text" },
  { key: "occupancy_status", label: "Occupancy", type: "text" },
  { key: "asking_price", label: "Asking Price", type: "number" },
  { key: "condition", label: "Condition", type: "text" },
  { key: "selling_timeline", label: "Selling Timeline", type: "text" },
];

export function LeadRecordClient({
  lead,
  updates,
  hasPhotos: initialHasPhotos,
}: {
  lead: LeadWithRelations;
  updates: UpdateWithAuthor[];
  hasPhotos: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mapProvider, setMapProvider] = useState<"google" | "apple">("google");
  const [hasPhotos, setHasPhotos] = useState(initialHasPhotos);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editName, setEditName] = useState(lead.name);
  const [editAddress, setEditAddress] = useState(
    lead.properties[0]?.address || lead.mailing_address || ""
  );
  const [editAskingPrice, setEditAskingPrice] = useState(
    lead.asking_price?.toString() || ""
  );
  const [editOccupancy, setEditOccupancy] = useState(
    lead.occupancy_status || ""
  );
  const [editCondition, setEditCondition] = useState(lead.condition || "");
  const [editSellingTimeline, setEditSellingTimeline] = useState(
    lead.selling_timeline || ""
  );

  // Phone/email add state
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const propertyAddress = lead.properties[0]?.address;
  const displayAddress = propertyAddress || lead.mailing_address;
  const primaryPhone =
    lead.phones.find((p) => p.is_primary) || lead.phones[0];
  const primaryEmail =
    lead.emails.find((e) => e.is_primary) || lead.emails[0];

  function startEditing() {
    setEditName(lead.name);
    setEditAddress(lead.properties[0]?.address || lead.mailing_address || "");
    setEditAskingPrice(lead.asking_price?.toString() || "");
    setEditOccupancy(lead.occupancy_status || "");
    setEditCondition(lead.condition || "");
    setEditSellingTimeline(lead.selling_timeline || "");
    setEditing(true);
  }

  function handleSave() {
    startTransition(async () => {
      await updateLead(lead.id, {
        name: editName,
        mailing_address: editAddress || null,
        asking_price: editAskingPrice ? Number(editAskingPrice) : null,
        occupancy_status: editOccupancy || null,
        condition: editCondition || null,
        selling_timeline: editSellingTimeline || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  function handleAddPhone() {
    if (!newPhone.trim()) return;
    startTransition(async () => {
      await addLeadPhone(lead.id, {
        phone_number: newPhone.trim(),
        is_primary: lead.phones.length === 0,
      });
      setNewPhone("");
      router.refresh();
    });
  }

  function handleAddEmail() {
    if (!newEmail.trim()) return;
    startTransition(async () => {
      await addLeadEmail(lead.id, {
        email: newEmail.trim(),
        is_primary: lead.emails.length === 0,
      });
      setNewEmail("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-6">
      {/* Lead details + Map row */}
      <div className={`grid gap-6 ${propertyAddress ? "grid-cols-2" : "grid-cols-1"}`}>
        {/* Lead details */}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-3 relative">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-base font-semibold tracking-tight font-editable border-b border-neutral-300 outline-none bg-transparent w-full"
                />
              ) : (
                <h2 className="text-base font-semibold tracking-tight font-editable">
                  {lead.name}
                </h2>
              )}
              {lead.date_converted && (
                <p
                  className="text-neutral-400 mt-0.5"
                  style={{ fontSize: "0.55rem" }}
                >
                  First Contact: {formatDate(lead.date_converted)}
                </p>
              )}
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
                onClick={startEditing}
                className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50 ml-2 shrink-0"
              >
                Edit
              </button>
            )}
          </div>

          {/* Address - full width row */}
          <div className="text-sm">
            <dt className="text-neutral-500 text-xs">Address</dt>
            <dd className="font-editable text-sm">
              {editing ? (
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                />
              ) : displayAddress ? (
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(displayAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {displayAddress}
                </a>
              ) : (
                "\u2014"
              )}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* Column 1: Asking Price, Occupancy, Condition, Selling Timeline */}
            <div className="space-y-2">
              <div>
                <dt className="text-neutral-500 text-xs">Asking Price</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      type="number"
                      value={editAskingPrice}
                      onChange={(e) => setEditAskingPrice(e.target.value)}
                      placeholder="0"
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : lead.asking_price ? (
                    `$${lead.asking_price.toLocaleString()}`
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Occupancy</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      value={editOccupancy}
                      onChange={(e) => setEditOccupancy(e.target.value)}
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : (
                    lead.occupancy_status || "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Condition</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      value={editCondition}
                      onChange={(e) => setEditCondition(e.target.value)}
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : (
                    lead.condition || "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Selling Timeline</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      value={editSellingTimeline}
                      onChange={(e) => setEditSellingTimeline(e.target.value)}
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : (
                    lead.selling_timeline || "\u2014"
                  )}
                </dd>
              </div>
            </div>

            {/* Column 2: Phone, Email, Photos */}
            <div className="space-y-2">
              <div>
                <dt className="text-neutral-500 text-xs">Phone</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <div className="space-y-1">
                      {lead.phones.map((p) => (
                        <div key={p.id} className="flex items-center gap-1">
                          <span className="text-sm">{p.phone_number}</span>
                          {p.is_primary && (
                            <span className="text-xs text-green-600">
                              &#9733;
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await removeLeadPhone(p.id);
                                router.refresh();
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-red-400 hover:text-red-600 ml-1"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1 mt-1">
                        <input
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="Add phone..."
                          className="flex-1 border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddPhone()
                          }
                        />
                        <button
                          type="button"
                          onClick={handleAddPhone}
                          disabled={isPending}
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : primaryPhone ? (
                    <a
                      href={`tel:${primaryPhone.phone_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      {primaryPhone.phone_number}
                    </a>
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Email</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <div className="space-y-1">
                      {lead.emails.map((e) => (
                        <div key={e.id} className="flex items-center gap-1">
                          <span className="text-sm">{e.email}</span>
                          {e.is_primary && (
                            <span className="text-xs text-green-600">
                              &#9733;
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await removeLeadEmail(e.id);
                                router.refresh();
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-red-400 hover:text-red-600 ml-1"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-1 mt-1">
                        <input
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Add email..."
                          className="flex-1 border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddEmail()
                          }
                        />
                        <button
                          type="button"
                          onClick={handleAddEmail}
                          disabled={isPending}
                          className="text-xs text-neutral-500 hover:text-neutral-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : primaryEmail ? (
                    <span>{primaryEmail.email}</span>
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Photos</dt>
                <dd>
                  {hasPhotos ? (
                    <span className="text-sm font-medium text-green-600">
                      Available
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-sm">
                      {"\u2014"}
                    </span>
                  )}
                </dd>
              </div>
            </div>
          </div>

          {displayAddress && (
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(displayAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Search property on Google"
              className="absolute bottom-2 right-3 text-neutral-400 hover:text-neutral-600 transition-colors font-extrabold"
              style={{ fontSize: "1rem" }}
            >
              G
            </a>
          )}
        </div>

        {/* Map (right side, same row as lead details) */}
        {propertyAddress && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-neutral-700">Map</h2>
              <div className="flex rounded border border-neutral-300 text-xs">
                <button
                  type="button"
                  onClick={() => setMapProvider("google")}
                  className={`px-2 py-0.5 ${
                    mapProvider === "google"
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setMapProvider("apple")}
                  className={`px-2 py-0.5 border-l border-neutral-300 ${
                    mapProvider === "apple"
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  Apple
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-400">
              <div className="text-center">
                <p>
                  {mapProvider === "google" ? "Google Maps" : "Apple Maps"}{" "}
                  placeholder
                </p>
                <p className="mt-1 text-xs">{propertyAddress}</p>
                <p className="mt-2 text-xs text-neutral-300">
                  Map integration coming in a future phase
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Property Information */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm space-y-2">
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
                const json = await res.json();
                if (json.success && json.data) {
                  await updateProperty(propertyId, json.data);
                  router.refresh();
                  return;
                }
              }
              alert(
                "Could not find property data on Redfin. You can edit fields manually."
              );
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
          hashtagFields={LEAD_HASHTAG_FIELDS}
          onHashtagUpdate={async (fieldUpdates) => {
            const { email, ...rest } = fieldUpdates;
            if (email && typeof email === "string") {
              await addLeadEmail(lead.id, {
                email,
                label: "",
                is_primary: false,
              });
            }
            if (Object.keys(rest).length > 0) {
              await updateLead(lead.id, rest);
            }
            router.refresh();
          }}
          onPhotosChanged={(detected) => setHasPhotos(detected)}
        />
      </div>
    </section>
  );
}
