"use client";

import { useState, useEffect } from "react";
import { getUsageStats } from "@/actions/usage-stats";
import { dealIndexUrl } from "@/lib/deal-url";

export function HomeBusinessStats() {
  const [stats, setStats] = useState<{
    monthLabel: string;
    leadsAddedMonth: number;
    leadsArchivedMonth: number;
    activeMarketing: number;
    dealsAssignedMonth: number;
    dealsClosedMonth: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getUsageStats();
      if (result.success) {
        const b = result.data.business;
        setStats({
          monthLabel: b.monthLabel,
          leadsAddedMonth: b.leadsAddedMonth,
          leadsArchivedMonth: b.leadsArchivedMonth,
          activeMarketing: b.activeMarketing,
          dealsAssignedMonth: b.dealsAssignedMonth,
          dealsClosedMonth: b.dealsClosedMonth,
        });
      }
    }
    load();
  }, []);

  if (!stats) return null;

  // Four counters for the month, which reset on the 1st. Active Marketing is
  // deliberately NOT one of them - it is a live count of what is on the deal
  // index, so it sits apart with its own label rather than under the month
  // heading implying it accrues.
  const monthly = [
    { label: "Leads Added", value: stats.leadsAddedMonth },
    { label: "Leads Archived", value: stats.leadsArchivedMonth },
    { label: "Deals Assigned", value: stats.dealsAssignedMonth },
    { label: "Deals Closed", value: stats.dealsClosedMonth },
  ];

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm text-center">
      <h2 className="text-sm font-semibold text-neutral-700 mb-1">Business Stats</h2>
      <p className="text-[0.55rem] text-neutral-400 uppercase tracking-wider mb-3">
        {stats.monthLabel || "This Month"}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {monthly.map((item) => (
          <div
            key={item.label}
            className="rounded border border-dashed border-neutral-300 bg-white px-2 py-2 text-center"
          >
            <p className="text-lg font-semibold font-editable">{item.value}</p>
            <p className="text-[0.55rem] text-neutral-500 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-dashed border-neutral-200 pt-2">
        <p className="text-[0.6rem] text-neutral-500">
          <span className="font-semibold font-editable text-neutral-700">{stats.activeMarketing}</span>{" "}
          on the{" "}
          {/* Opens on the marketing host in a new tab: it is a different site
              from the app, and Randy is usually mid-task here. */}
          <a
            href={dealIndexUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-600 underline decoration-dotted underline-offset-2 hover:text-neutral-900"
          >
            deal index
          </a>{" "}
          now
        </p>
      </div>
    </div>
  );
}
