"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { updateProperty } from "@/actions/properties";
import type { Property } from "@/lib/types";

type PropertyCardProps = {
  property: Property;
  onPopulate: (propertyId: string) => Promise<Partial<Property> | null>;
};

type FieldDef = {
  label: string;
  key: keyof Property;
  type: "text" | "number";
};

const leftFields: FieldDef[] = [
  { label: "Address", key: "address", type: "text" },
  { label: "Year Built", key: "year_built", type: "number" },
  { label: "Beds", key: "bedrooms", type: "number" },
  { label: "Baths", key: "bathrooms", type: "number" },
  { label: "APN", key: "apn", type: "text" },
  { label: "Owner", key: "owner_name", type: "text" },
];

const rightFields: FieldDef[] = [
  { label: "Sqft", key: "sqft", type: "number" },
  { label: "Lot Size", key: "lot_size", type: "text" },
  { label: "Owner Address", key: "owner_mailing_address", type: "text" },
  { label: "Zoning", key: "zoning", type: "text" },
  { label: "Redfin Value", key: "redfin_value", type: "number" },
  { label: "Zillow Value", key: "zillow_value", type: "number" },
  { label: "County Value", key: "county_value", type: "number" },
];

const DOLLAR_FIELDS: (keyof Property)[] = [
  "redfin_value",
  "zillow_value",
  "county_value",
];

// Auto-populate triggers if any of these are empty
const SCRAPER_FIELDS: (keyof Property)[] = [
  "redfin_value",
  "zillow_value",
  "apn",
];

// County assessor URLs — APN replaces %s
const COUNTY_URLS: Record<string, string> = {
  king: "https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s",
  pierce: "https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary",
  snohomish: "https://www.snoco.org/proptax/search.aspx?parcel_number=%s",
  thurston: "https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s",
  kitsap: "https://psearch.kitsapgov.com/details.asp?RPID=%s",
  skagit: "https://www.skagitcounty.net/Search/Property/?id=%s",
};

function getCountyUrl(county: string | null, apn: string | null): string | null {
  if (!county || !apn) return null;
  const template = COUNTY_URLS[county.toLowerCase()];
  if (!template) return null;
  return template.replace("%s", apn);
}

const allEditableFields = [...leftFields, ...rightFields];

export function PropertyCard({ property, onPopulate }: PropertyCardProps) {
  const [prop, setProp] = useState(property);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [populateStatus, setPopulateStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const autoPopulateRan = useRef(false);

  // Auto-populate on mount if any scraped field is still empty
  useEffect(() => {
    if (autoPopulateRan.current) return;
    const hasEmpty = SCRAPER_FIELDS.some((k) => !prop[k]);
    if (!hasEmpty) return;

    autoPopulateRan.current = true;
    runPopulate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runPopulate() {
    setPopulateStatus("loading");
    onPopulate(prop.id)
      .then((data) => {
        if (data) {
          setProp((prev) => ({ ...prev, ...data }));
          setPopulateStatus("done");
          setTimeout(() => setPopulateStatus("idle"), 7000);
        } else {
          setPopulateStatus("error");
        }
      })
      .catch(() => setPopulateStatus("error"));
  }

  function handlePopulate() {
    startTransition(() => runPopulate());
  }

  function startEditing() {
    const values: Record<string, string> = {};
    for (const field of allEditableFields) {
      values[field.key] = String(prop[field.key] ?? "");
    }
    values.legal_description = String(prop.legal_description ?? "");
    setEditValues(values);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditValues({});
  }

  function handleSave() {
    startTransition(async () => {
      const updates: Record<string, unknown> = {};

      for (const field of allEditableFields) {
        const editVal = editValues[field.key] ?? "";
        const currentVal = String(prop[field.key] ?? "");
        if (editVal !== currentVal) {
          if (field.type === "number") {
            updates[field.key] = editVal ? Number(editVal) : null;
          } else {
            updates[field.key] = editVal || null;
          }
        }
      }
      // Legal description
      const editLegal = editValues.legal_description ?? "";
      const currentLegal = String(prop.legal_description ?? "");
      if (editLegal !== currentLegal) {
        updates.legal_description = editLegal || null;
      }

      if (Object.keys(updates).length > 0) {
        const result = await updateProperty(prop.id, updates);
        if (result.success) {
          setProp(result.data);
        } else {
          alert("Could not save: " + result.error);
          return;
        }
      }
      setEditing(false);
      setEditValues({});
    });
  }

  function formatValue(key: keyof Property) {
    if (DOLLAR_FIELDS.includes(key) && prop[key]) {
      return `$${(prop[key] as number).toLocaleString()}`;
    }
    return String(prop[key] ?? "\u2014");
  }

  function renderField({ label, key, type }: FieldDef) {
    const isApn = key === "apn";
    const countyUrl = isApn ? getCountyUrl(prop.county, prop.apn as string | null) : null;

    return (
      <div key={key} className="flex justify-between">
        <dt className="text-neutral-500 text-xs">{label}</dt>
        {editing ? (
          <dd>
            <input
              value={editValues[key] ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
              }
              className="w-24 rounded border border-neutral-200 px-1 py-0.5 text-right text-xs font-editable"
            />
          </dd>
        ) : (
          <dd className="text-neutral-700 text-xs font-editable">
            {isApn && countyUrl && prop.apn ? (
              <a
                href={countyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 hover:underline"
              >
                {prop.apn}
              </a>
            ) : (
              formatValue(key)
            )}
          </dd>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-500">
          Property Details
          {populateStatus === "loading" && (
            <span className="ml-2 text-neutral-400 animate-pulse">
              Populating...
            </span>
          )}
          {populateStatus === "done" && (
            <span className="ml-2 text-green-600">Populated</span>
          )}
          {populateStatus === "error" && (
            <span className="ml-2 text-red-500">Could not populate</span>
          )}
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePopulate}
            disabled={isPending || populateStatus === "loading"}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
          >
            Populate
          </button>
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isPending}
                className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded border border-[#c5cca8] bg-[#e8edda] px-2 py-0.5 text-xs font-medium hover:bg-[#dce3cb] disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <dl className="space-y-0.5 text-sm">
          {leftFields.map(renderField)}
        </dl>
        <dl className="space-y-0.5 text-sm">
          {rightFields.map(renderField)}
        </dl>
      </div>

      {/* Legal description — full width */}
      <div className="flex gap-2 text-sm">
        <dt className="text-neutral-500 text-xs shrink-0">Legal Desc</dt>
        {editing ? (
          <dd className="flex-1">
            <input
              value={editValues.legal_description ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  legal_description: e.target.value,
                }))
              }
              className="w-full rounded border border-neutral-200 px-1 py-0.5 text-xs font-editable"
            />
          </dd>
        ) : (
          <dd className="text-neutral-700 text-xs font-editable">
            {String(prop.legal_description ?? "\u2014")}
          </dd>
        )}
      </div>
    </div>
  );
}
