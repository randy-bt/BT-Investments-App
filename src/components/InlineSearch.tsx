"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/search";

type Result = { id: string; name: string; subtitle?: string };

export function InlineSearch({
  mode,
}: {
  mode: "leads" | "investors";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch({ query: query.trim() });
        if (res.success) {
          setResults(
            mode === "leads"
              ? res.data.leads.map((l) => ({ id: l.id, name: l.name, subtitle: l.address }))
              : res.data.investors.map((i) => ({ id: i.id, name: i.name }))
          );
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, mode, startTransition]);

  function handleSelect(id: string) {
    const path =
      mode === "leads"
        ? `/app/acquisitions/lead-record/${id}`
        : `/app/dispositions/investor-record/${id}`;
    setQuery("");
    setResults([]);
    window.open(path, "_blank");
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (!val.trim() || val.length < 2) setResults([]);
        }}
        className="w-full rounded-md border border-neutral-300 bg-neutral-50 pl-3 pr-8 py-1.5 text-sm font-editable outline-none focus:border-neutral-400 focus:bg-white"
      />
      {isPending ? (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
          ...
        </span>
      ) : (
        <svg
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )}
      {results.length > 0 && query.length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.id)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
            >
              {r.name}
              {r.subtitle && (
                <span className="ml-2 text-xs text-neutral-400">{r.subtitle}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && !isPending && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg px-3 py-2 text-sm text-neutral-400">
          No results found
        </div>
      )}
    </div>
  );
}
