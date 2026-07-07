"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/search";
import type { SearchResults } from "@/lib/types";

/**
 * Which result categories to include in the flattened item list.
 * "all" includes leads + investors + properties;
 * "leads-investors" excludes properties (InlineSearch's "all" mode).
 */
export type SearchScope = "leads" | "investors" | "leads-investors" | "all";

export type SearchItem = {
  id: string;
  name: string;
  subtitle?: string;
  type: "lead" | "investor" | "property";
  path: string;
};

export function flattenSearchResults(results: SearchResults, scope: SearchScope): SearchItem[] {
  const items: SearchItem[] = [];
  if (scope !== "investors") {
    for (const lead of results.leads) {
      items.push({ id: lead.id, name: lead.name, subtitle: lead.address, type: "lead", path: `/app/acquisitions/lead-record/${lead.id}` });
    }
  }
  if (scope !== "leads") {
    for (const inv of results.investors) {
      items.push({ id: inv.id, name: inv.name, subtitle: inv.phone, type: "investor", path: `/app/dispositions/investor-record/${inv.id}` });
    }
  }
  if (scope === "all") {
    for (const prop of results.properties) {
      items.push({ id: prop.id, name: prop.address, subtitle: `(${prop.lead_name})`, type: "property", path: `/app/acquisitions/lead-record/${prop.lead_id}` });
    }
  }
  return items;
}

type UseSearchOptions = {
  scope?: SearchScope;
  /** Clear results + highlight when Escape is pressed in the input. Disable when Escape is handled elsewhere (e.g. modal close). */
  escapeClears?: boolean;
  /** Clear results when clicking outside `containerRef`. Disable for backdrop-based overlays. */
  clickOutsideClears?: boolean;
  /** Scroll the highlighted `[data-search-item]` inside `listRef` into view as the highlight moves. */
  scrollHighlightIntoView?: boolean;
  /** Called just before navigating to a selected result (e.g. to close a modal). */
  onNavigate?: () => void;
};

export function useSearch({
  scope = "all",
  escapeClears = true,
  clickOutsideClears = true,
  scrollHighlightIntoView = true,
  onNavigate,
}: UseSearchOptions = {}) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Clear stale results as soon as the query drops below the search threshold
  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    if (!value.trim() || value.length < 2) {
      setResults(null);
      setHighlightIndex(-1);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
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
    if (!clickOutsideClears) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [clickOutsideClears]);

  const navigate = useCallback(
    (path: string) => {
      onNavigate?.();
      setQueryState("");
      setResults(null);
      setHighlightIndex(-1);
      if (path.includes("/lead-record/") || path.includes("/investor-record/")) {
        window.open(path, "_blank");
      } else {
        router.push(path);
      }
    },
    [router, onNavigate]
  );

  const items = useMemo(
    () => (results ? flattenSearchResults(results, scope) : []),
    [results, scope]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < items.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : items.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      navigate(items[highlightIndex].path);
    } else if (e.key === "Escape" && escapeClears) {
      setResults(null);
      setHighlightIndex(-1);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!scrollHighlightIntoView || highlightIndex < 0 || !listRef.current) return;
    const buttons = listRef.current.querySelectorAll("[data-search-item]");
    (buttons[highlightIndex] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, scrollHighlightIntoView]);

  return {
    query,
    setQuery,
    results,
    items,
    isPending,
    highlightIndex,
    handleKeyDown,
    navigate,
    containerRef,
    listRef,
  };
}
