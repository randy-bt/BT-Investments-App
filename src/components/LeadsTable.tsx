"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getLeads } from "@/actions/leads";
import { StatusBadge } from "@/components/StatusBadge";
import { StageBadge } from "@/components/StageBadge";
import type {
  Lead,
  LeadStage,
  EntityStatus,
  PaginatedResult,
} from "@/lib/types";

type LeadsTableProps = {
  initialData: PaginatedResult<Lead>;
};

export function LeadsTable({ initialData }: LeadsTableProps) {
  const [data, setData] = useState(initialData);
  const [statusFilter, setStatusFilter] = useState<EntityStatus | "">("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "">("");
  const [isPending, startTransition] = useTransition();

  function loadPage(page: number) {
    startTransition(async () => {
      const result = await getLeads({
        page,
        status: statusFilter || undefined,
        stage: stageFilter || undefined,
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
      <div className="flex flex-wrap gap-3 text-sm">
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
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as LeadStage | "")}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All Stages</option>
          <option value="follow_up">Follow Up</option>
          <option value="lead">Lead</option>
          <option value="marketing_on_hold">Marketing On Hold</option>
          <option value="marketing_active">Marketing Active</option>
          <option value="assigned_in_escrow">Assigned / In Escrow</option>
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
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/app/acquisitions/lead-record/${lead.id}`}
                    className="text-neutral-800 hover:underline font-editable"
                  >
                    {lead.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={lead.stage} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-3 py-2 text-neutral-500">
                  {lead.source_campaign_name || "\u2014"}
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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
    </div>
  );
}
