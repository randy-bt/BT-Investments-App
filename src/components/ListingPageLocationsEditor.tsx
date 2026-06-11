"use client";

import { useEffect, useState, useTransition } from "react";
import { searchLocations, getLocationsForListingPage, setListingPageLocations } from "@/actions/locations";
import type { Location, LocationKind } from "@/lib/types";

const KIND_STYLES: Record<LocationKind, string> = {
  city: "bg-[#ebeee0] dark:bg-[#2a2f1c] text-[#3d4a1c] dark:text-[#dce5b8] border-[#c5cca8]",
  neighborhood: "bg-[#ebeee0] dark:bg-[#2a2f1c] text-[#3d4a1c] dark:text-[#dce5b8] border-[#c5cca8]",
  county: "bg-[#ddebe5] dark:bg-[#1a2f25] text-[#1f4d3a] dark:text-[#9ec8b6] border-[#88b59f]",
  region: "bg-[#e0e3eb] dark:bg-[#1c2240] text-[#2a3458] dark:text-[#a3afd9] border-[#99a3c2]",
  state: "bg-[#f0e3eb] dark:bg-[#3a1c22] text-[#58342a] dark:text-[#d9a3af] border-[#c099a3]",
};

export function ListingPageLocationsEditor({ listingPageId }: { listingPageId: string }) {
  const [chips, setChips] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [, startPending] = useTransition();

  useEffect(() => {
    (async () => {
      const r = await getLocationsForListingPage(listingPageId);
      if (r.success) setChips(r.data);
      setLoading(false);
    })();
  }, [listingPageId]);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length === 0) {
        setSuggestions([]);
        return;
      }
      const r = await searchLocations(q);
      if (r.success) {
        const ids = new Set(chips.map((c) => c.id));
        setSuggestions(r.data.filter((l) => !ids.has(l.id)));
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, chips]);

  function save(next: Location[]) {
    startPending(async () => {
      const result = await setListingPageLocations(listingPageId, next.map((c) => c.id));
      if (!result.success) {
        alert("Could not save locations: " + result.error);
      }
    });
  }

  function handleAdd(loc: Location) {
    const next = [...chips, loc];
    setChips(next);
    setQuery("");
    setSuggestions([]);
    save(next);
  }

  function handleRemove(id: string) {
    const next = chips.filter((c) => c.id !== id);
    setChips(next);
    save(next);
  }

  if (loading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading locations…</p>;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Locations covered
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2.5 min-h-[44px]">
        {chips.length === 0 && (
          <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No locations set — investors won&rsquo;t see this deal as a match.</span>
        )}
        {chips.map((c) => (
          <span
            key={c.id}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${KIND_STYLES[c.kind]}`}
          >
            <span>{c.name}</span>
            <span className="opacity-50">{c.kind}</span>
            <button onClick={() => handleRemove(c.id)} className="ml-1 font-semibold" aria-label={`Remove ${c.name}`}>×</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a location…"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleAdd(s)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{s.kind}{s.state_code ? ` · ${s.state_code}` : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
