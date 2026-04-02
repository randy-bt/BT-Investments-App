"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { getInvestors } from "@/actions/investors";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { Investor, PaginatedResult } from "@/lib/types";

type InvestorsTableProps = {
  initialData: PaginatedResult<Investor>;
  unviewedIds?: string[];
};

export function InvestorsTable({ initialData, unviewedIds = [] }: InvestorsTableProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const refreshCurrentPage = useCallback(() => {
    startTransition(async () => {
      const result = await getInvestors({ page: data.page, status: "active" });
      if (result.success) setData(result.data);
    });
  }, [data.page]);

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
      const result = await getInvestors({ page, status: "active" });
      if (result.success) setData(result.data);
    });
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium text-neutral-700">Investor Records ({data.total})</h2>
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

      {/* Table */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2 w-[22%]">Name</th>
              <th className="px-3 py-2 w-[22%]">Locations</th>
              <th className="px-3 py-2 w-[10%]">Status</th>
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
                  <div className="flex items-center gap-2">
                    <a
                      href={`/app/dispositions/investor-record/${investor.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 hover:underline font-editable"
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
                <td className="px-3 py-2 text-neutral-500 truncate">
                  {investor.locations_of_interest}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={investor.status} />
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {formatDateTime(investor.updated_at)}
                  {investor.updated_by_name && (
                    <span className="ml-1">- {investor.updated_by_name}</span>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={4}
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
