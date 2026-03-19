"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getInvestors } from "@/actions/investors";
import { StatusBadge } from "@/components/StatusBadge";
import type { Investor, EntityStatus, PaginatedResult } from "@/lib/types";

type InvestorsTableProps = {
  initialData: PaginatedResult<Investor>;
};

export function InvestorsTable({ initialData }: InvestorsTableProps) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<EntityStatus | "">("");
  const [isPending, startTransition] = useTransition();

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getInvestors({
        page,
        status: statusFilter || undefined,
      });
      if (result.success) setData(result.data);
    });
  }

  function applyFilters() {
    loadPage(1);
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 text-sm">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as EntityStatus | "")
          }
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="button"
          onClick={applyFilters}
          disabled={isPending}
          className="rounded border border-neutral-400 bg-neutral-50 px-3 py-1 hover:bg-neutral-100"
        >
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Locations</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((investor) => (
              <tr
                key={investor.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/app/dispositions/investor-record/${investor.id}`}
                    className="text-neutral-800 hover:underline font-editable"
                  >
                    {investor.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {investor.company || "\u2014"}
                </td>
                <td className="px-3 py-2 text-neutral-500 max-w-[200px] truncate">
                  {investor.locations_of_interest}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={investor.status} />
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(investor.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
    </div>
  );
}
