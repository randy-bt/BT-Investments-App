"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [searching, startSearch] = useTransition();
  const [pending, startPending] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length === 0) {
        setSuggestions([]);
        return;
      }
      startSearch(async () => {
        const result = await searchLocations(q);
        if (result.success) {
          // Filter out already-added chips
          const ids = new Set(chips.map((c) => c.id));
          setSuggestions(result.data.filter((l) => !ids.has(l.id)));
        }
      });
    }, 150);
    return () => clearTimeout(t);
  }, [query, chips]);

  function handleAdd(location: Location) {
    setQuery("");
    setSuggestions([]);
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

  async function handleCreateAndAdd(name: string) {
    const result = await createLocation({ name, kind: "city" });
    if (!result.success) {
      alert("Could not create location: " + result.error);
      return;
    }
    handleAdd(result.data);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 min-h-[60px]">
        {chips.length === 0 && (
          <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No locations yet. Add one below.</span>
        )}
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
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a location… (city, county, region)"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />

        {(suggestions.length > 0 || (query.trim().length >= 2 && !searching)) && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleAdd(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  {s.kind}{s.state_code ? ` · ${s.state_code}` : ""}
                </span>
              </button>
            ))}
            {query.trim().length >= 2 && (
              <button
                onClick={() => handleCreateAndAdd(query.trim())}
                className="block w-full border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left text-sm text-[#5D3954] dark:text-[#b890ac] hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                + Create new location &ldquo;{query.trim()}&rdquo; as city
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
