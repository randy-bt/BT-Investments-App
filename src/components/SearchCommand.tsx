"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { globalSearch } from "@/actions/search";
import type { SearchResults } from "@/lib/types";

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearch({ query: query.trim() });
        if (res.success) setResults(res.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, startTransition]);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      setResults(null);
      if (
        path.includes("/lead-record/") ||
        path.includes("/investor-record/")
      ) {
        window.open(path, "_blank");
      } else {
        router.push(path);
      }
    },
    [router]
  );

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
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim() || val.length < 2) setResults(null);
            }}
            placeholder="Search anything"
            className="flex-1 py-3 text-sm outline-none font-editable"
          />
          {isPending && (
            <span className="text-xs text-neutral-400">Searching...</span>
          )}
        </div>

        {hasResults && (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.leads.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Leads
                </p>
                {results.leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() =>
                      navigate(`/app/acquisitions/lead-record/${lead.id}`)
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {lead.name}
                    {lead.address && (
                      <span className="ml-2 text-xs text-neutral-400">
                        {lead.address}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {results.investors.length > 0 && (
              <div className="mb-2">
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Investors
                </p>
                {results.investors.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/dispositions/investor-record/${inv.id}`
                      )
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {inv.name}
                  </button>
                ))}
              </div>
            )}

            {results.properties.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium text-neutral-400 uppercase">
                  Properties
                </p>
                {results.properties.map((prop) => (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/acquisitions/lead-record/${prop.lead_id}`
                      )
                    }
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    {prop.address}
                    <span className="ml-2 text-xs text-neutral-400">
                      ({prop.lead_name})
                    </span>
                  </button>
                ))}
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
    </div>
  );
}
