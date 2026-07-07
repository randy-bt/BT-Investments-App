"use client";

import { useSearch } from "@/hooks/useSearch";
import { SearchResultRows } from "@/components/SearchResultRows";

export function HomeSearch() {
  const {
    query,
    setQuery,
    results,
    isPending,
    highlightIndex,
    handleKeyDown,
    navigate,
    containerRef,
    listRef,
  } = useSearch();

  const hasResults =
    results &&
    (results.leads.length > 0 ||
      results.investors.length > 0 ||
      results.properties.length > 0);

  const showDropdown = query.length >= 2 && (hasResults || isPending || results !== null);

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
              <SearchResultRows
                results={results}
                highlightIndex={highlightIndex}
                onNavigate={navigate}
              />
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
