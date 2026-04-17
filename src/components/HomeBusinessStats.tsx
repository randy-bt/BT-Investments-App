"use client";

import { useState, useEffect } from "react";
import { getUsageStats } from "@/actions/usage-stats";

export function HomeBusinessStats() {
  const [stats, setStats] = useState<{
    leadsAdded30: number;
    leadsClosed30: number;
    investorsAdded30: number;
    dealsAssigned30: number;
    dealsClosed30: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getUsageStats();
      if (result.success) {
        setStats({
          leadsAdded30: result.data.business.leadsAdded30,
          leadsClosed30: result.data.business.leadsClosed30,
          investorsAdded30: result.data.business.investorsAdded30,
          dealsAssigned30: result.data.business.dealsAssigned30,
          dealsClosed30: result.data.business.dealsClosed30,
        });
      }
    }
    load();
  }, []);

  if (!stats) return null;

  const items = [
    { label: "Leads Added", value: stats.leadsAdded30 },
    { label: "Leads Closed", value: stats.leadsClosed30 },
    { label: "Investors Added", value: stats.investorsAdded30 },
    { label: "Deals Assigned", value: stats.dealsAssigned30 },
    { label: "Deals Closed", value: stats.dealsClosed30 },
  ];

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm text-center">
      <h2 className="text-sm font-semibold text-neutral-700 mb-1">
        Business Stats
      </h2>
      <p className="text-[0.55rem] text-neutral-400 uppercase tracking-wider mb-3">Last 30 Days</p>
      <div className="grid grid-cols-5 gap-2">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-dashed border-neutral-300 bg-white px-2 py-2 text-center">
            <p className="text-lg font-semibold font-editable">{item.value}</p>
            <p className="text-[0.55rem] text-neutral-500 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
