"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updateLead,
  addLeadPhone,
  removeLeadPhone,
  addLeadEmail,
  removeLeadEmail,
} from "@/actions/leads";
import { addProperty, updateProperty, removeProperty } from "@/actions/properties";
import { ActivityFeed, type HashtagField, type QuickAction } from "@/components/ActivityFeed";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PropertyCard } from "@/components/PropertyCard";
import { GoogleMap } from "@/components/GoogleMap";
import { formatDate } from "@/lib/format";
import type { LeadWithRelations, Update } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string; author_role?: string };

const LEAD_HASHTAG_FIELDS: HashtagField[] = [
  { key: "email", label: "Email", type: "text" },
  { key: "occupancy_status", label: "Occupancy", type: "text" },
  { key: "asking_price", label: "Asking Price", type: "text" },
  { key: "our_current_offer", label: "Our Current Offer", type: "number" },
  { key: "range", label: "Range", type: "text" },
  { key: "condition", label: "Condition", type: "text" },
  { key: "selling_timeline", label: "Selling Timeline", type: "text" },
];

const LEAD_QUICK_ACTIONS: QuickAction[] = [
  { label: "Called, no answer", content: "Called, no answer" },
  { label: "Left voicemail", content: "Left voicemail" },
  { label: "Sent text", content: "Sent text" },
  { label: "Sent email", content: "Sent email" },
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
  const [selectedPropIdx, setSelectedPropIdx] = useState(0);
  const [addingProperty, setAddingProperty] = useState(false);
  const [newPropertyAddress, setNewPropertyAddress] = useState("");

  // Map resize state
  const MAP_MIN_HEIGHT = 400;
  const [mapHeight, setMapHeight] = useState(MAP_MIN_HEIGHT);
  const mapResizing = useRef(false);
  const mapStartY = useRef(0);
  const mapStartH = useRef(0);

  const onMapResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mapResizing.current = true;
    mapStartY.current = e.clientY;
    mapStartH.current = mapHeight;

    const onMove = (ev: MouseEvent) => {
      if (!mapResizing.current) return;
      const delta = ev.clientY - mapStartY.current;
      setMapHeight(Math.max(MAP_MIN_HEIGHT, mapStartH.current + delta));
    };
    const onUp = () => {
      mapResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [mapHeight]);

  const selectedProperty = lead.properties[selectedPropIdx] || lead.properties[0];

  // Edit state
  const [editName, setEditName] = useState(lead.name);
  const [editAddress, setEditAddress] = useState(
    selectedProperty?.address || lead.mailing_address || ""
  );
  const [editAskingPrice, setEditAskingPrice] = useState(
    lead.asking_price || ""
  );
  const [editOccupancy, setEditOccupancy] = useState(
    lead.occupancy_status || ""
  );
  const [editCondition, setEditCondition] = useState(lead.condition || "");
  const [editSellingTimeline, setEditSellingTimeline] = useState(
    lead.selling_timeline || ""
  );
  const [editOurOffer, setEditOurOffer] = useState(
    lead.our_current_offer?.toString() || ""
  );
  const [editRange, setEditRange] = useState(lead.range || "");
  const [editPhotoUrl, setEditPhotoUrl] = useState(lead.photo_url || "");

  // Phone/email add state
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const propertyAddress = selectedProperty?.address;
  const displayAddress = propertyAddress || lead.mailing_address;
  const primaryPhone =
    lead.phones.find((p) => p.is_primary) || lead.phones[0];
  const primaryEmail =
    lead.emails.find((e) => e.is_primary) || lead.emails[0];

  function startEditing() {
    setEditName(lead.name);
    setEditAddress(selectedProperty?.address || lead.mailing_address || "");
    setEditAskingPrice(lead.asking_price || "");
    setEditOccupancy(lead.occupancy_status || "");
    setEditCondition(lead.condition || "");
    setEditSellingTimeline(lead.selling_timeline || "");
    setEditOurOffer(lead.our_current_offer?.toString() || "");
    setEditRange(lead.range || "");
    setEditPhotoUrl(lead.photo_url || "");
    setEditing(true);
  }

  function handleSave() {
    startTransition(async () => {
      // Only send fields that changed
      const updates: Record<string, unknown> = {};
      const trimmedName = editName.trim() || lead.name;
      if (trimmedName !== lead.name) updates.name = trimmedName;
      if ((editAddress || null) !== (lead.mailing_address || null)) updates.mailing_address = editAddress || null;
      const newAskingPrice = editAskingPrice || null;
      if (newAskingPrice !== lead.asking_price) updates.asking_price = newAskingPrice;
      if ((editOccupancy || null) !== (lead.occupancy_status || null)) updates.occupancy_status = editOccupancy || null;
      if ((editCondition || null) !== (lead.condition || null)) updates.condition = editCondition || null;
      if ((editSellingTimeline || null) !== (lead.selling_timeline || null)) updates.selling_timeline = editSellingTimeline || null;
      if ((editRange || null) !== (lead.range || null)) updates.range = editRange || null;
      if ((editPhotoUrl || null) !== (lead.photo_url || null)) updates.photo_url = editPhotoUrl || null;
      const newOurOffer = editOurOffer ? Number(editOurOffer) : null;
      if (newOurOffer !== lead.our_current_offer) updates.our_current_offer = newOurOffer;

      let result: { success: boolean; error?: string } = { success: true };
      if (Object.keys(updates).length > 0) {
        result = await updateLead(lead.id, updates);
      }
      if (!result.success) {
        alert("Could not save: " + result.error);
        return;
      }
      // Also update the property address if it changed
      if (selectedProperty && editAddress !== (selectedProperty.address || "")) {
        await updateProperty(selectedProperty.id, { address: editAddress || null });
      }
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

  function handleAddNewProperty() {
    if (!newPropertyAddress.trim()) return;
    startTransition(async () => {
      await addProperty(lead.id, { address: newPropertyAddress.trim() });
      setNewPropertyAddress("");
      setAddingProperty(false);
      router.refresh();
      // Select the newly added property (will be last)
      setSelectedPropIdx(lead.properties.length);
    });
  }

  function handleRemoveProperty(propertyId: string, idx: number) {
    if (!confirm("Remove this property?")) return;
    startTransition(async () => {
      await removeProperty(propertyId);
      if (selectedPropIdx >= idx && selectedPropIdx > 0) {
        setSelectedPropIdx(selectedPropIdx - 1);
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-6">
      {/* Lead details + Map row */}
      <div className={`grid gap-6 ${propertyAddress ? "grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : "grid-cols-1"}`}>
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

          {/* Address - full width */}
          <div className="text-sm">
            <dt className="text-neutral-500 text-xs flex items-center gap-1.5">
              Address
              {!editing && !addingProperty && (
                <button
                  type="button"
                  onClick={() => setAddingProperty(true)}
                  className="text-[0.6rem] text-neutral-400 hover:text-neutral-600"
                  title="Add another property"
                >
                  +
                </button>
              )}
            </dt>
            {addingProperty && (
              <div className="flex items-center gap-1 mt-1 mb-1">
                <AddressAutocomplete
                  value={newPropertyAddress}
                  onChange={setNewPropertyAddress}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-editable flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddNewProperty}
                  disabled={isPending || !newPropertyAddress.trim()}
                  className="text-xs text-neutral-600 hover:text-neutral-800 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingProperty(false);
                    setNewPropertyAddress("");
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  &times;
                </button>
              </div>
            )}
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
                  className="text-cyan-600 font-semibold hover:underline"
                >
                  {displayAddress}
                </a>
              ) : (
                "\u2014"
              )}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {/* Column 1 */}
            <div className="space-y-2">
              <div>
                <dt className="text-neutral-500 text-xs">Phone</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <div className="space-y-1">
                      {lead.phones.map((p) => (
                        <div key={p.id} className="flex items-center gap-1">
                          <span className="text-sm">{p.phone_number}</span>
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
                      className="text-cyan-600 font-semibold hover:underline"
                    >
                      {primaryPhone.phone_number}
                    </a>
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs flex items-center gap-1">Occupancy<span className={`inline-block h-1.5 w-1.5 rounded-full ${lead.occupancy_status ? "bg-green-500" : "bg-yellow-400"}`} /></dt>
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
                <dt className="text-neutral-500 text-xs flex items-center gap-1">Selling Timeline<span className={`inline-block h-1.5 w-1.5 rounded-full ${lead.selling_timeline ? "bg-green-500" : "bg-yellow-400"}`} /></dt>
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
              <div>
                <dt className="text-neutral-500 text-xs flex items-center gap-1">Condition<span className={`inline-block h-1.5 w-1.5 rounded-full ${lead.condition ? "bg-green-500" : "bg-yellow-400"}`} /></dt>
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
                <dt className="text-neutral-500 text-xs flex items-center gap-1">Photos<span className={`inline-block h-1.5 w-1.5 rounded-full ${hasPhotos || lead.photo_url ? "bg-green-500" : "bg-yellow-400"}`} /></dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      type="text"
                      value={editPhotoUrl}
                      onChange={(e) => setEditPhotoUrl(e.target.value)}
                      placeholder="Paste link..."
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : lead.photo_url ? (
                    <a href={lead.photo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      Link
                    </a>
                  ) : hasPhotos ? (
                    <span className="text-sm text-neutral-800">Available</span>
                  ) : (
                    <span className="text-neutral-400">{"\u2014"}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs flex items-center gap-1">Asking Price<span className={`inline-block h-1.5 w-1.5 rounded-full ${lead.asking_price ? "bg-green-500" : "bg-yellow-400"}`} /></dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      type="text"
                      value={editAskingPrice}
                      onChange={(e) => setEditAskingPrice(e.target.value)}
                      placeholder=""
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : lead.asking_price ? (
                    lead.asking_price
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-2">
              <div>
                <dt className="text-neutral-500 text-xs">Email</dt>
                <dd className="font-editable text-sm min-w-0">
                  {editing ? (
                    <div className="space-y-1">
                      {lead.emails.map((e) => (
                        <div key={e.id} className="flex items-center gap-1">
                          <span className="text-sm break-all">{e.email}</span>
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
                    <span className="block break-all">{primaryEmail.email}</span>
                  ) : (
                    "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Our Range</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      value={editRange}
                      onChange={(e) => setEditRange(e.target.value)}
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : (
                    lead.range || "\u2014"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500 text-xs">Our Current Offer</dt>
                <dd className="font-editable text-sm">
                  {editing ? (
                    <input
                      type="number"
                      value={editOurOffer}
                      onChange={(e) => setEditOurOffer(e.target.value)}
                      placeholder="0"
                      className="w-full border-b border-neutral-300 outline-none bg-transparent text-sm font-editable"
                    />
                  ) : lead.our_current_offer ? (
                    `$${lead.our_current_offer.toLocaleString()}`
                  ) : (
                    "\u2014"
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
          <div
            className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm flex flex-col relative"
            style={{ minHeight: mapHeight }}
          >
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
            <div className="flex-1 rounded overflow-hidden">
              {mapProvider === "google" ? (
                <GoogleMap address={propertyAddress} />
              ) : (
                <div className="flex flex-col flex-1 items-center justify-center min-h-[250px] bg-neutral-50 gap-2">
                  <p className="text-xs text-neutral-400">Integration coming soon</p>
                  <a
                    href={`https://maps.apple.com/?q=${encodeURIComponent(propertyAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-neutral-500 hover:text-cyan-600 transition-colors"
                  >
                    Open in Apple Maps &rarr;
                  </a>
                </div>
              )}
            </div>
            {/* Bottom-right resize handle */}
            <div
              onMouseDown={onMapResizeStart}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-s-resize flex items-end justify-end pr-1 pb-1 opacity-40 hover:opacity-70 transition-opacity select-none"
              title="Drag to resize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-neutral-400">
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Property details */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm space-y-2">
        {/* Header with optional property pills */}
        {lead.properties.length > 1 && (
          <div className="flex items-center gap-2 mb-1">
            {lead.properties.map((property, idx) => (
              <button
                key={property.id}
                type="button"
                onClick={() => {
                  setSelectedPropIdx(idx);
                  setEditAddress(property.address || "");
                }}
                className={`group flex items-center gap-1 rounded-full border px-2 py-px text-[0.65rem] transition-colors ${
                  idx === selectedPropIdx
                    ? "border-neutral-800 bg-neutral-800 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Property {idx + 1}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveProperty(property.id, idx);
                  }}
                  className={`ml-0.5 cursor-pointer text-[0.6rem] leading-none ${
                    idx === selectedPropIdx
                      ? "text-neutral-400 hover:text-white"
                      : "text-neutral-300 hover:text-red-500"
                  }`}
                >
                  &times;
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected property details */}
        {selectedProperty ? (
          <PropertyCard
            key={selectedProperty.id}
            property={selectedProperty}
            onPopulate={async (propertyId) => {
              const res = await fetch("/api/properties/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  propertyId,
                  address: selectedProperty.address,
                }),
              });
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                  // Only fill in fields that are currently empty
                  const updates: Record<string, unknown> = {};
                  for (const [key, value] of Object.entries(json.data)) {
                    if (value != null && !selectedProperty[key as keyof typeof selectedProperty]) {
                      updates[key] = value;
                    }
                  }
                  if (Object.keys(updates).length > 0) {
                    const result = await updateProperty(propertyId, updates);
                    if (result.success) return result.data;
                  }
                  return selectedProperty;
                }
              }
              return null;
            }}
          />
        ) : (
          <p className="text-xs text-neutral-400">No properties</p>
        )}
      </div>

      {/* Activity feed */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <ActivityFeed
          entityType="lead"
          entityId={lead.id}
          entityName={lead.name}
          initialUpdates={updates}
          hashtagFields={LEAD_HASHTAG_FIELDS}
          quickActions={LEAD_QUICK_ACTIONS}
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
