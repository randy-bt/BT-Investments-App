"use client";

import { useSearch } from "@/hooks/useSearch";

export function InlineSearch({
  mode,
}: {
  mode: "leads" | "investors" | "all";
}) {
  const {
    query,
    setQuery,
    items,
    isPending,
    highlightIndex,
    handleKeyDown,
    navigate,
    containerRef,
    listRef,
  } = useSearch({
    // InlineSearch's "all" means leads + investors only (no properties).
    scope: mode === "all" ? "leads-investors" : mode,
  });

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
      {items.length > 0 && query.length >= 2 && (
        <div ref={listRef} className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {items.map((r, i) => (
            <button
              key={r.id}
              type="button"
              data-search-item
              onClick={() => navigate(r.path)}
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
      {query.length >= 2 && !isPending && items.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg px-3 py-2 text-sm text-neutral-400">
          No results found
        </div>
      )}
    </div>
  );
}
