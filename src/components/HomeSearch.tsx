"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/search";
import type { SearchResults } from "@/lib/types";

type FlatItem = { id: string; label: string; subtitle?: string; path: string };

function flattenResults(results: SearchResults): FlatItem[] {
  const items: FlatItem[] = [];
  for (const lead of results.leads) {
    items.push({ id: lead.id, label: lead.name, subtitle: lead.address, path: `/app/acquisitions/lead-record/${lead.id}` });
  }
  for (const inv of results.investors) {
    items.push({ id: inv.id, label: inv.name, subtitle: inv.phone, path: `/app/dispositions/investor-record/${inv.id}` });
  }
  for (const prop of results.properties) {
    items.push({ id: prop.id, label: prop.address, subtitle: `(${prop.lead_name})`, path: `/app/acquisitions/lead-record/${prop.lead_id}` });
  }
  return items;
}

export function HomeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch({ query: query.trim() });
        if (res.success) { setResults(res.data); setHighlightIndex(-1); }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, startTransition]);

  // Close results on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(path: string) {
    setQuery("");
    setResults(null);
    setHighlightIndex(-1);
    if (path.includes("/lead-record/") || path.includes("/investor-record/")) {
      window.open(path, "_blank");
    } else {
      router.push(path);
    }
  }

  const hasResults =
    results &&
    (results.leads.length > 0 ||
      results.investors.length > 0 ||
      results.properties.length > 0);

  const flatItems = results ? flattenResults(results) : [];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < flatItems.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : flatItems.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      navigate(flatItems[highlightIndex].path);
    } else if (e.key === "Escape") {
      setResults(null);
      setHighlightIndex(-1);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const buttons = listRef.current.querySelectorAll("[data-search-item]");
    (buttons[highlightIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const showDropdown = query.length >= 2 && (hasResults || isPending || results !== null);

  // Track flat index for highlighting across categories
  let flatIdx = -1;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex w-full items-center gap-3 rounded-full border border-neutral-300 bg-white px-5 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-neutral-400">
        <svg
          className="text-neutral-400 shrink-0"
          width="18"
          height="18"
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search leads, investors, properties..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        {isPending && (
          <span className="text-xs text-neutral-400 shrink-0">Searching...</span>
        )}
      </div>

      {showDropdown && (
        <div ref={listRef} className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-neutral-200 bg-white shadow-lg z-10 overflow-hidden">
          {hasResults && (
            <div className="max-h-80 overflow-y-auto p-2">
              {results.leads.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                    Leads
                  </p>
                  {results.leads.map((lead) => {
                    flatIdx++;
                    const idx = flatIdx;
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        data-search-item
                        onClick={() => navigate(`/app/acquisitions/lead-record/${lead.id}`)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${idx === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                      >
                        {lead.name}
                        {lead.address && (
                          <span className="ml-2 text-xs text-neutral-400">
                            {lead.address}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {results.investors.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                    Investors
                  </p>
                  {results.investors.map((inv) => {
                    flatIdx++;
                    const idx = flatIdx;
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        data-search-item
                        onClick={() => navigate(`/app/dispositions/investor-record/${inv.id}`)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${idx === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                      >
                        {inv.name}
                        {inv.phone && (
                          <span className="ml-2 text-xs text-neutral-400">
                            {inv.phone}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {results.properties.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                    Properties
                  </p>
                  {results.properties.map((prop) => {
                    flatIdx++;
                    const idx = flatIdx;
                    return (
                      <button
                        key={prop.id}
                        type="button"
                        data-search-item
                        onClick={() => navigate(`/app/acquisitions/lead-record/${prop.lead_id}`)}
                        className={`w-full rounded px-2 py-1.5 text-left text-sm ${idx === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                      >
                        {prop.address}
                        <span className="ml-2 text-xs text-neutral-400">
                          ({prop.lead_name})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {query.length >= 2 && !isPending && !hasResults && (
            <p className="p-4 text-center text-sm text-neutral-400">
              No results found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
