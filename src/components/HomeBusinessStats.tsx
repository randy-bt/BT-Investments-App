"use client";

import { useState, useEffect } from "react";
import { getUsageStats } from "@/actions/usage-stats";

export function HomeBusinessStats() {
  const [stats, setStats] = useState<{
    leadsAdded30: number;
    leadsClosed30: number;
    investorsAdded30: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getUsageStats();
      if (result.success) {
        setStats({
          leadsAdded30: result.data.business.leadsAdded30,
          leadsClosed30: result.data.business.leadsClosed30,
          investorsAdded30: result.data.business.investorsAdded30,
        });
      }
    }
    load();
  }, []);

  if (!stats) return null;

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
      <h2 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Last 30 Days
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-dashed border-neutral-300 bg-white px-3 py-2 text-center">
          <p className="text-lg font-semibold font-editable">{stats.leadsAdded30}</p>
          <p className="text-[0.6rem] text-neutral-500">Leads Added</p>
        </div>
        <div className="rounded border border-dashed border-neutral-300 bg-white px-3 py-2 text-center">
          <p className="text-lg font-semibold font-editable">{stats.leadsClosed30}</p>
          <p className="text-[0.6rem] text-neutral-500">Leads Closed</p>
        </div>
        <div className="rounded border border-dashed border-neutral-300 bg-white px-3 py-2 text-center">
          <p className="text-lg font-semibold font-editable">{stats.investorsAdded30}</p>
          <p className="text-[0.6rem] text-neutral-500">Investors Added</p>
        </div>
      </div>
    </div>
  );
}
