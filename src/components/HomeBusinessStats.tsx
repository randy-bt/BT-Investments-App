"use client";

import { useState, useEffect } from "react";
import { getUsageStats } from "@/actions/usage-stats";
import { dealIndexUrl } from "@/lib/deal-url";

export function HomeBusinessStats() {
  const [stats, setStats] = useState<{
    monthLabel: string;
    leadsAddedMonth: number;
    leadsArchivedMonth: number;
    readyForDispo: number;
    dealsInDispo: number;
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
          readyForDispo: b.readyForDispo,
          dealsInDispo: b.dealsInDispo,
          dealsAssignedMonth: b.dealsAssignedMonth,
          dealsClosedMonth: b.dealsClosedMonth,
        });
      }
    }
    load();
  }, []);

  if (!stats) return null;

  // Six tiles in PIPELINE ORDER (agent-requests #14.6): a lead comes in,
  // gets archived or moves on, becomes a dispo deal, gets assigned, closes.
  // The two dispo tiles are LIVE counts (status-driven, nothing manually
  // maintained), unlike their monthly neighbors that reset on the 1st;
  // Deals in Dispo doubles as the link to the deal index, which replaced
  // the old footer line.
  const tiles: Array<{ label: string; value: number; live?: boolean; href?: string }> = [
    { label: "Leads Added", value: stats.leadsAddedMonth },
    { label: "Leads Archived", value: stats.leadsArchivedMonth },
    { label: "Ready for Dispo", value: stats.readyForDispo, live: true },
    { label: "Deals in Dispo", value: stats.dealsInDispo, live: true, href: dealIndexUrl() },
    { label: "Deals Assigned", value: stats.dealsAssignedMonth },
    { label: "Deals Closed", value: stats.dealsClosedMonth },
  ];

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm text-center">
      <h2 className="text-sm font-semibold text-neutral-700 mb-1">Business Stats</h2>
      <p className="text-[0.55rem] text-neutral-400 uppercase tracking-wider mb-3">
        {stats.monthLabel || "This Month"}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {tiles.map((item) => {
          const inner = (
            <>
              <p className="text-lg font-semibold font-editable">{item.value}</p>
              <p className="text-[0.55rem] text-neutral-500 leading-tight">
                {item.label}
                {/* Live tiles do not reset with the month; the dot marks them. */}
                {item.live && <span className="ml-0.5 align-middle text-[0.5rem] text-[#5c6e2d]">●</span>}
              </p>
            </>
          );
          return item.href ? (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-dashed border-neutral-300 bg-white px-2 py-2 text-center transition-colors hover:border-[#c5cca8] hover:bg-[#f4f6ec]"
              title="Open the deal index"
            >
              {inner}
            </a>
          ) : (
            <div key={item.label} className="rounded border border-dashed border-neutral-300 bg-white px-2 py-2 text-center">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
