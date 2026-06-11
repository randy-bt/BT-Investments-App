"use client";

import { useState, useTransition, useEffect } from "react";
import { searchLocations, createLocation } from "@/actions/locations";
import { addInvestorLocation, removeInvestorLocation } from "@/actions/investors";
import type { Location, LocationKind } from "@/lib/types";

const KIND_STYLES: Record<LocationKind, { icon: string; bg: string; border: string; text: string; darkBg: string; darkText: string }> = {
  city: { icon: "📍", bg: "bg-[#ebeee0]", border: "border-[#c5cca8]", text: "text-[#3d4a1c]", darkBg: "dark:bg-[#2a2f1c]", darkText: "dark:text-[#dce5b8]" },
  neighborhood: { icon: "📍", bg: "bg-[#ebeee0]", border: "border-[#c5cca8]", text: "text-[#3d4a1c]", darkBg: "dark:bg-[#2a2f1c]", darkText: "dark:text-[#dce5b8]" },
  county: { icon: "🏛", bg: "bg-[#ddebe5]", border: "border-[#88b59f]", text: "text-[#1f4d3a]", darkBg: "dark:bg-[#1a2f25]", darkText: "dark:text-[#9ec8b6]" },
  region: { icon: "🌲", bg: "bg-[#e0e3eb]", border: "border-[#99a3c2]", text: "text-[#2a3458]", darkBg: "dark:bg-[#1c2240]", darkText: "dark:text-[#a3afd9]" },
  state: { icon: "🗺", bg: "bg-[#f0e3eb]", border: "border-[#c099a3]", text: "text-[#58342a]", darkBg: "dark:bg-[#3a1c22]", darkText: "dark:text-[#d9a3af]" },
};

export function LocationChipPicker({
  investorId,
  initialLocations,
  onChange,
}: {
  investorId: string;
  initialLocations: Location[];
  onChange?: () => void;
}) {
  const [chips, setChips] = useState<Location[]>(initialLocations);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startPending] = useTransition();

  function handleAdd(location: Location) {
    setChips((prev) => [...prev, location]);
    startPending(async () => {
      const result = await addInvestorLocation(investorId, location.id);
      if (!result.success) {
        alert("Could not add location: " + result.error);
        setChips((prev) => prev.filter((c) => c.id !== location.id));
        return;
      }
      onChange?.();
    });
  }

  function handleRemove(location: Location) {
    setChips((prev) => prev.filter((c) => c.id !== location.id));
    startPending(async () => {
      const result = await removeInvestorLocation(investorId, location.id);
      if (!result.success) {
        alert("Could not remove location: " + result.error);
        setChips((prev) => [...prev, location]);
        return;
      }
      onChange?.();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 min-h-[52px]">
        {chips.map((c) => {
          const s = KIND_STYLES[c.kind];
          return (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${s.bg} ${s.border} ${s.text} ${s.darkBg} ${s.darkText}`}
            >
              <span>{s.icon}</span>
              <span>{c.name}</span>
              <span className="opacity-50">{c.kind}</span>
              <button
                onClick={() => handleRemove(c)}
                disabled={pending}
                className="ml-1 font-semibold opacity-70 hover:opacity-100"
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          onClick={() => setPickerOpen(true)}
          title="Add a location"
          aria-label="Add a location"
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-400 dark:border-neutral-600 px-2.5 py-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:border-[#42501f] hover:text-[#42501f] dark:hover:border-[#c5cca8] dark:hover:text-[#c5cca8]"
        >
          + Add
        </button>
      </div>

      {pickerOpen && (
        <LocationSearchPopup
          existingIds={new Set(chips.map((c) => c.id))}
          onSelect={handleAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function LocationSearchPopup({
  existingIds,
  onSelect,
  onClose,
}: {
  existingIds: Set<string>;
  onSelect: (location: Location) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length === 0) {
        setSuggestions([]);
        return;
      }
      const result = await searchLocations(q);
      if (result.success) {
        setSuggestions(result.data.filter((l) => !existingIds.has(l.id)));
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, existingIds]);

  function handlePick(location: Location) {
    onSelect(location);
    setAdded((prev) => [...prev, location.name]);
    setQuery("");
    setSuggestions([]);
  }

  async function handleCreateAndPick(name: string) {
    const result = await createLocation({ name, kind: "city" });
    if (!result.success) {
      alert("Could not create location: " + result.error);
      return;
    }
    handlePick(result.data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#42501f] px-4 py-3 text-white">
          <span className="text-sm font-semibold">Add location of interest</span>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        <div className="p-4">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search cities, counties, regions…"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />

          {added.length > 0 && (
            <p className="mt-2 text-xs text-[#42501f] dark:text-[#c5cca8]">
              ✓ Added: {added.join(", ")}
            </p>
          )}

          <div className="mt-2 flex flex-col">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handlePick(s)}
                className="flex items-baseline gap-2 rounded px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {s.kind}{s.state_code ? ` · ${s.state_code}` : ""}
                </span>
              </button>
            ))}
            {query.trim().length >= 2 && (
              <button
                onClick={() => handleCreateAndPick(query.trim())}
                className="mt-1 rounded border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left text-sm text-[#42501f] dark:text-[#c5cca8] hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                + Create new location &ldquo;{query.trim()}&rdquo; as city
              </button>
            )}
            {query.trim().length === 0 && (
              <p className="px-3 py-2 text-xs italic text-neutral-400 dark:text-neutral-500">
                Start typing to search the location catalog.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-4 py-2.5 text-right">
          <button
            onClick={onClose}
            className="rounded-md bg-[#42501f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#36421a]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
