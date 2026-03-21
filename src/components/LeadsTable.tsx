"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getLeads } from "@/actions/leads";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { LeadWithAddress, PaginatedResult } from "@/lib/types";

type LeadsTableProps = {
  initialData: PaginatedResult<LeadWithAddress>;
};

export function LeadsTable({ initialData }: LeadsTableProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getLeads({ page, status: "active" });
      if (result.success) setData(result.data);
    });
  }

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-neutral-700">Lead Records</h2>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/app/acquisitions/lead-record/${lead.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 hover:underline font-editable"
                    >
                      {lead.name}
                    </a>
                    {lead.status === "closed" && (
                      <StatusBadge status="closed" />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {lead.address || "\u2014"}
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {formatDateTime(lead.updated_at)}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-8 text-center text-neutral-400"
                >
                  No leads found
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

      {/* Closed Leads button */}
      <div className="flex justify-end">
        <Link
          href="/app/acquisitions/closed-leads"
          className="rounded border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs hover:bg-neutral-100"
        >
          Closed Leads
        </Link>
      </div>
    </div>
  );
}
