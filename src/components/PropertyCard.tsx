"use client";

import { useState, useTransition } from "react";
import { updateProperty } from "@/actions/properties";
import type { Property } from "@/lib/types";

type PropertyCardProps = {
  property: Property;
  onPopulate: (propertyId: string) => Promise<void>;
};

const fields: {
  label: string;
  key: keyof Property;
  type: "text" | "number";
}[] = [
  { label: "Address", key: "address", type: "text" },
  { label: "APN", key: "apn", type: "text" },
  { label: "Year Built", key: "year_built", type: "number" },
  { label: "Beds", key: "bedrooms", type: "number" },
  { label: "Baths", key: "bathrooms", type: "number" },
  { label: "Sqft", key: "sqft", type: "number" },
  { label: "Lot Size", key: "lot_size", type: "text" },
  { label: "Type", key: "property_type", type: "text" },
  { label: "Owner", key: "owner_name", type: "text" },
  { label: "Redfin Value", key: "redfin_value", type: "number" },
];

export function PropertyCard({ property, onPopulate }: PropertyCardProps) {
  const [prop, setProp] = useState(property);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleSave(field: keyof Property, value: string | number | null) {
    startTransition(async () => {
      const result = await updateProperty(prop.id, { [field]: value });
      if (result.success) {
        setProp(result.data);
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-500">
          Property Details
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => startTransition(() => onPopulate(prop.id))}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50 disabled:opacity-50"
          >
            Populate
          </button>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
        {fields.map(({ label, key, type }) => (
          <div key={key} className="flex justify-between">
            <dt className="text-neutral-500 text-xs">{label}</dt>
            {editing ? (
              <dd>
                <input
                  defaultValue={String(prop[key] ?? "")}
                  onBlur={(e) => {
                    const val =
                      type === "number"
                        ? e.target.value
                          ? Number(e.target.value)
                          : null
                        : e.target.value || null;
                    handleSave(key, val as string | number | null);
                  }}
                  className="w-24 rounded border border-neutral-200 px-1 py-0.5 text-right text-xs font-editable"
                />
              </dd>
            ) : (
              <dd className="text-neutral-700 text-xs font-editable">
                {key === "redfin_value" && prop[key]
                  ? `$${(prop[key] as number).toLocaleString()}`
                  : String(prop[key] ?? "\u2014")}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
