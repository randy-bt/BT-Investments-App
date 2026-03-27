"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { globalSearch } from "@/actions/search";

type Result = { id: string; name: string; subtitle?: string; type: "lead" | "investor" | "property"; path: string };

export function InlineSearch({
  mode,
}: {
  mode: "leads" | "investors" | "all";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch({ query: query.trim() });
        if (res.success) {
          const items: Result[] = [];
          if (mode === "leads" || mode === "all") {
            for (const l of res.data.leads) {
              items.push({ id: l.id, name: l.name, subtitle: l.address, type: "lead", path: `/app/acquisitions/lead-record/${l.id}` });
            }
          }
          if (mode === "investors" || mode === "all") {
            for (const i of res.data.investors) {
              items.push({ id: i.id, name: i.name, subtitle: i.phone, type: "investor", path: `/app/dispositions/investor-record/${i.id}` });
            }
          }
          setResults(items);
          setHighlightIndex(-1);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, mode, startTransition]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(r: Result) {
    setQuery("");
    setResults([]);
    setHighlightIndex(-1);
    window.open(r.path, "_blank");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setResults([]);
      setHighlightIndex(-1);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const showDropdown = query.length >= 2 && (results.length > 0 || isPending || results !== null);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          if (!val.trim() || val.length < 2) { setResults([]); setHighlightIndex(-1); }
        }}
        onKeyDown={handleKeyDown}
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
        <div ref={listRef} className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className={`w-full px-3 py-2 text-left text-sm border-b border-neutral-100 last:border-0 ${
                i === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
              }`}
            >
              {r.name}
              {r.subtitle && (
                <span className="ml-2 text-xs text-neutral-400">{r.subtitle}</span>
              )}
              {mode === "all" && (
                <span className="ml-2 text-[10px] text-neutral-400">{r.type === "lead" ? "Lead" : "Investor"}</span>
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
