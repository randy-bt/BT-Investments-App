"use client";

import { useState, useEffect } from "react";
import type { UsageStats } from "@/actions/usage-stats";
import { getUsageStats } from "@/actions/usage-stats";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

type Period = "today" | "last30" | "allTime";
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  last30: "Last 30 Days",
  allTime: "All Time",
};

export function UsageMonitor() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("last30");

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
        <div className="h-20 rounded bg-neutral-100" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-sm text-neutral-400">Failed to load usage data.</p>;
  }

  const usage = stats[period];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5 w-fit">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              period === p
                ? "bg-white text-neutral-800 shadow-sm border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* API Usage */}
      <div className="grid grid-cols-2 gap-3">
        <ProviderCard
          name="Anthropic"
          usage={usage.anthropic}
          color="bg-amber-50 border-amber-200"
        />
        <ProviderCard
          name="OpenAI"
          usage={usage.openai}
          color="bg-emerald-50 border-emerald-200"
        />
      </div>

      {/* Combined cost */}
      <div className="flex items-center justify-between rounded border border-dashed border-neutral-300 px-4 py-2.5">
        <span className="text-xs text-neutral-500">
          Total Estimated Cost ({PERIOD_LABELS[period]})
        </span>
        <span className="text-sm font-semibold font-editable">
          {formatCost(usage.anthropic.estimated_cost + usage.openai.estimated_cost)}
        </span>
      </div>

      {/* Business stats */}
      <div>
        <h3 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Business (Last 30 Days)
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Leads Added" value={stats.business.leadsAdded30} />
          <StatCard label="Leads Closed" value={stats.business.leadsClosed30} />
          <StatCard label="Investors Added" value={stats.business.investorsAdded30} />
        </div>
      </div>

      {/* News stats */}
      <div>
        <h3 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
          News
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Articles" value={stats.news.totalArticles} />
          <StatCard label="Added Today" value={stats.news.addedToday} />
          <StatCard label="Failed Summaries" value={stats.news.failedSummaries} />
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  usage,
  color,
}: {
  name: string;
  usage: { input_tokens: number; output_tokens: number; estimated_cost: number; call_count: number };
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-neutral-700">{name}</span>
        <span className="text-xs text-neutral-500">{usage.call_count} calls</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[0.7rem] text-neutral-600">
          <span>Input</span>
          <span className="font-editable">{formatTokens(usage.input_tokens)}</span>
        </div>
        <div className="flex justify-between text-[0.7rem] text-neutral-600">
          <span>Output</span>
          <span className="font-editable">{formatTokens(usage.output_tokens)}</span>
        </div>
        <div className="flex justify-between text-[0.7rem] text-neutral-700 font-medium pt-1 border-t border-neutral-200/50">
          <span>Cost</span>
          <span className="font-editable">{formatCost(usage.estimated_cost)}</span>
        </div>
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
