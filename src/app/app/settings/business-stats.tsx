"use client";

import { useState, useEffect } from "react";
import type { UsageStats } from "@/actions/usage-stats";
import { getUsageStats } from "@/actions/usage-stats";

export function BusinessStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNews, setShowNews] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await getUsageStats();
      if (result.success) setStats(result.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-neutral-200" />
        <div className="h-16 rounded bg-neutral-100" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-neutral-400">Failed to load stats.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Last 30 Days */}
      <div>
        <h3 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Last 30 Days
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Leads Added" value={stats.business.leadsAdded30} />
          <StatCard label="Leads Closed" value={stats.business.leadsClosed30} />
          <StatCard label="Investors Added" value={stats.business.investorsAdded30} />
        </div>
      </div>

      {/* Monthly breakdown toggle */}
      {stats.monthlyBusiness.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMonthly((s) => !s)}
            className="flex items-center gap-1.5 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider hover:text-neutral-600 transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${showMonthly ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Month by Month
          </button>
          {showMonthly && (
            <div className="mt-2 space-y-3">
              {stats.monthlyBusiness.map((m) => (
                <div key={m.key}>
                  <p className="text-[0.6rem] text-neutral-400 uppercase tracking-wider mb-1">
                    {m.label}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="Leads Added" value={m.leadsAdded} />
                    <StatCard label="Leads Closed" value={m.leadsClosed} />
                    <StatCard label="Investors Added" value={m.investorsAdded} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* News stats toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowNews((s) => !s)}
          className="flex items-center gap-1.5 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider hover:text-neutral-600 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${showNews ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          News Stats
        </button>
        {showNews && (
          <div className="mt-2 grid grid-cols-3 gap-3">
            <StatCard label="Total Articles" value={stats.news.totalArticles} />
            <StatCard label="Added Today" value={stats.news.addedToday} />
            <StatCard label="Failed Summaries" value={stats.news.failedSummaries} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-dashed border-neutral-300 bg-white px-3 py-2 text-center">
      <p className="text-lg font-semibold font-editable">{value}</p>
      <p className="text-[0.6rem] text-neutral-500">{label}</p>
    </div>
  );
}
