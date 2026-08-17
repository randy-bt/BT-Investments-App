"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { getInvestors } from "@/actions/investors";
import { deriveLocationChips, compactDateTime } from "@/lib/investor-chips";
import type { EntityStatus, Investor, PaginatedResult } from "@/lib/types";

type TabValue = EntityStatus | "jv_partner";

type InvestorsTableProps = {
  initialData: PaginatedResult<Investor>;
  unviewedIds?: string[];
  /** Rendered inside a Collapsible whose header already says "Investor
   *  Records" - suppresses the duplicate inner title (restructure 8/17). */
  hideTitle?: boolean;
};

// Status buckets surfaced in the pill bar. Archived has its own
// dedicated page (link at the bottom) so it stays out of this filter.
// JV Partners is a CATEGORY, not a status: the records that absorbed the
// retired jv_partners board, carrying a type instead of a buying status.
const STATUS_FILTERS: { label: string; value: TabValue }[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Onboarding", value: "onboarding" },
  { label: "JV Partners", value: "jv_partner" },
];

// One line per row, ALWAYS (Randy's hard constraint). The dot + compact
// timestamp reclaim the width the Locations chips spend.
const STATUS_DOT: Record<string, { cls: string; label: string }> = {
  active: { cls: "bg-green-500", label: "Active" },
  inactive: { cls: "bg-red-500", label: "Inactive" },
  onboarding: { cls: "bg-amber-400", label: "Onboarding" },
  archived: { cls: "bg-neutral-300", label: "Archived" },
  closed: { cls: "bg-neutral-300", label: "Closed" },
};

const PARTNER_LABEL: Record<string, string> = {
  wholesaler: "Wholesaler",
  agent: "Agent",
  reference: "Reference",
};

export function InvestorsTable({ initialData, unviewedIds = [], hideTitle = false }: InvestorsTableProps) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<TabValue>("active");
  const [isPending, startTransition] = useTransition();

  const refreshCurrentPage = useCallback(() => {
    startTransition(async () => {
      const result = await getInvestors({ page: data.page, status: statusFilter });
      if (result.success) setData(result.data);
    });
  }, [data.page, statusFilter]);

  // Auto-refresh: on visibility change + poll every 30s while visible
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshCurrentPage();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refreshCurrentPage();
    }, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [refreshCurrentPage]);

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getInvestors({ page, status: statusFilter });
      if (result.success) setData(result.data);
    });
  }

  function changeStatus(status: TabValue) {
    if (status === statusFilter) return;
    setStatusFilter(status);
    startTransition(async () => {
      const result = await getInvestors({ page: 1, status });
      if (result.success) setData(result.data);
    });
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!hideTitle && (
            <h2 className="text-lg font-medium text-neutral-700">Investor Records ({data.total})</h2>
          )}
          <button
            type="button"
            onClick={refreshCurrentPage}
            disabled={isPending}
            className="rounded p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            title="Refresh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}>
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-10.624-2.85a5.5 5.5 0 019.201-2.465l.312.311H11.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.536a.75.75 0 00-1.5 0v2.033l-.312-.311A7 7 0 002.63 8.396a.75.75 0 001.449.39z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-0.5">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeStatus(opt.value)}
              disabled={isPending}
              className={`rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                statusFilter === opt.value
                  ? "bg-white text-neutral-800 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table. table-fixed is what makes the one-line rule enforceable:
          cells can truncate only when the browser knows their width.
          Width priority per Randy: LOCATIONS must show in full (they are
          the reason the column exists), NAMES may ellipsize. On the JV
          Partners tab the Locations column is dropped entirely - partners
          have no buying geography, and a column of placeholders reads as
          missing data. */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className={`px-3 py-2 ${statusFilter === "jv_partner" ? "w-[45%]" : "w-[22%]"}`}>Name</th>
              <th className="px-3 py-2 w-[9%]">Status</th>
              {statusFilter !== "jv_partner" && <th className="px-3 py-2 w-[47%]">Locations</th>}
              <th className="px-3 py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((investor) => (
              <tr
                key={investor.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href={`/app/dispositions/investor-record/${investor.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-neutral-800 hover:underline font-editable"
                      title={investor.name}
                    >
                      {investor.name}
                    </a>
                    {unviewedIds.includes(investor.id) && (
                      <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                        New
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {investor.jv_partner_type ? (
                    // Partners carry a TYPE, not a buying status.
                    <span className="text-xs text-neutral-500">
                      {PARTNER_LABEL[investor.jv_partner_type]}
                    </span>
                  ) : (
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${(STATUS_DOT[investor.status] ?? STATUS_DOT.archived).cls}`}
                      title={(STATUS_DOT[investor.status] ?? STATUS_DOT.archived).label}
                      role="img"
                      aria-label={(STATUS_DOT[investor.status] ?? STATUS_DOT.archived).label}
                    />
                  )}
                </td>
                {statusFilter !== "jv_partner" && (
                  <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
                    <LocationChipsCell investor={investor} />
                  </td>
                )}
                <td className="px-3 py-2 whitespace-nowrap text-neutral-400">
                  {compactDateTime(investor.updated_at)}
                  {investor.updated_by_name && (
                    <span className="ml-1">· {investor.updated_by_name}</span>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={statusFilter === "jv_partner" ? 3 : 4}
                  className="px-3 py-8 text-center text-neutral-400"
                >
                  No investors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {data.page} of {totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadPage(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              &larr; Prev
            </button>
            <button
              type="button"
              onClick={() => loadPage(data.page + 1)}
              disabled={data.page >= totalPages || isPending}
              className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50 disabled:opacity-50"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Archived Investors button */}
      <div className="flex justify-end">
        <Link
          href="/app/dispositions/archived-investors"
          className="rounded border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs hover:bg-neutral-100"
        >
          Archived Investors
        </Link>
      </div>
    </div>
  );
}

/** County chips + "+N" city reveal - the at-a-glance view that was the
 *  entire surviving value of the retired investor_database board. Chips
 *  stay on one line; city detail lives in the hover title. */
function LocationChipsCell({ investor }: { investor: Investor }) {
  const chips = deriveLocationChips(investor.location_links ?? null, investor.locations_of_interest);
  if (chips.counties.length === 0 && chips.cities.length === 0) {
    return <span className="text-xs text-neutral-300">no locations</span>;
  }
  // EVERY chip renders (Randy's v9.14 review: the +N collapse defeated
  // the column's purpose). Counties lead, cities follow lighter. A
  // genuinely extreme row ellipsizes at the column edge (cell-level
  // text-ellipsis) with the full list in the title - that one row, not
  // a global collapse.
  return (
    <span className="text-xs" title={chips.detail || undefined}>
      {chips.counties.map((c, i) => (
        <span key={`co-${c}`} className="text-neutral-600">
          {i > 0 && <span className="mx-1 text-neutral-300">·</span>}
          {c}
        </span>
      ))}
      {chips.cities.map((c, i) => (
        <span key={`ci-${c}`} className="text-neutral-400">
          {(chips.counties.length > 0 || i > 0) && <span className="mx-1 text-neutral-200">·</span>}
          {c}
        </span>
      ))}
    </span>
  );
}
