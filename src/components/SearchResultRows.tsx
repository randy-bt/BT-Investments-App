"use client";

import type { SearchResults } from "@/lib/types";

/**
 * Grouped Leads / Investors / Properties result rows shared by
 * HomeSearch and SearchCommand. Markup is copied verbatim from the
 * originals (which were identical apart from the data-search-item
 * attribute used for scroll-into-view).
 */
export function SearchResultRows({
  results,
  highlightIndex,
  onNavigate,
}: {
  results: SearchResults;
  highlightIndex: number;
  onNavigate: (path: string) => void;
}) {
  // Track flat index for highlighting across categories
  let flatIdx = -1;

  return (
    <>
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
                onClick={() => onNavigate(`/app/acquisitions/lead-record/${lead.id}`)}
                className={`w-full rounded px-2 py-1.5 text-left text-sm ${idx === highlightIndex ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
              >
                {lead.name}
                {lead.address && (
                  <span className="ml-2 text-xs text-neutral-400">
                    {lead.address}
                  </span>
                )}
                {lead.status === "closed" && (
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "#d4d4d4",
                      color: "#333",
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      verticalAlign: "middle",
                    }}
                  >
                    Closed
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
                onClick={() => onNavigate(`/app/dispositions/investor-record/${inv.id}`)}
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
                onClick={() => onNavigate(`/app/acquisitions/lead-record/${prop.lead_id}`)}
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
    </>
  );
}
