"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearch } from "@/hooks/useSearch";
import { SearchResultRows } from "@/components/SearchResultRows";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  const {
    query,
    setQuery,
    results,
    isPending,
    highlightIndex,
    handleKeyDown,
    navigate,
    listRef,
  } = useSearch({
    // Window-level Escape closes the whole modal below; no per-input Escape handling.
    escapeClears: false,
    // Backdrop click closes the modal instead of a document-level listener.
    clickOutsideClears: false,
    // The original modal did not scroll the highlighted row into view.
    scrollHighlightIntoView: false,
    onNavigate: handleClose,
  });

  // Cmd+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  const hasResults =
    results &&
    (results.leads.length > 0 ||
      results.investors.length > 0 ||
      results.properties.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-dashed border-neutral-300 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-dashed border-neutral-200 px-4">
          <svg
            className="shrink-0 text-neutral-400 mr-2"
            width="16"
            height="16"
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
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search anything"
            className="flex-1 py-3 text-sm outline-none font-editable"
          />
          {isPending && (
            <span className="text-xs text-neutral-400">Searching...</span>
          )}
        </div>

        {hasResults && (
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
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
    </div>
  );
}
