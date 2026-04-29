"use client";

import { useState } from "react";
import type { UsageStats } from "@/actions/usage-stats";

const FEATURE_LABELS: Record<string, string> = {
  news_scoring: "News Scoring",
  news_summary: "News Summarizer",
  news_headlines: "Headline Shortener",
  call_summary: "Call Summarizer",
  transcription: "Transcription",
  listing_page: "Listing Page Generator",
  property_scrape: "Property Scraper",
  news_tts: "News Read Aloud",
};

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

type Period = "today" | "last30" | "allTime";
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  last30: "Last 30 Days",
  allTime: "All Time",
};

export function UsageMonitor({ initialStats }: { initialStats: UsageStats | null }) {
  const [stats] = useState<UsageStats | null>(initialStats);
  const [period, setPeriod] = useState<Period>("last30");

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
        <ProviderCard name="Anthropic" usage={usage.anthropic} />
        <ProviderCard name="OpenAI" usage={usage.openai} />
      </div>
      {usage.elevenlabs.call_count > 0 && (
        <ProviderCard name="ElevenLabs" usage={usage.elevenlabs} />
      )}

      {/* Monthly cost totals */}
      {stats.monthlyCosts.length > 0 && (
        <div className="space-y-1">
          {stats.monthlyCosts.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between rounded border border-dashed border-neutral-300 px-4 py-2"
            >
              <span className="text-xs text-neutral-500">
                Total Estimated Cost ({m.label})
              </span>
              <span className="text-sm font-semibold font-editable">
                {formatCost(m.cost)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Combined total */}
      <div className="flex items-center justify-between rounded border border-neutral-400 px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-600">
          Total Estimated Cost ({PERIOD_LABELS[period]})
        </span>
        <span className="text-sm font-bold font-editable">
          {formatCost(usage.anthropic.estimated_cost + usage.openai.estimated_cost + usage.elevenlabs.estimated_cost)}
        </span>
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  usage,
}: {
  name: string;
  usage: {
    estimated_cost: number;
    call_count: number;
    features: Record<string, { estimated_cost: number; call_count: number }>;
  };
}) {
  const featureEntries = Object.entries(usage.features).sort(
    ([, a], [, b]) => b.estimated_cost - a.estimated_cost
  );

  return (
    <div className="rounded-lg border border-cyan-800/30 bg-cyan-950/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-cyan-100">{name}</span>
        <span className="text-xs text-cyan-400">{usage.call_count} calls</span>
      </div>
      <div className="space-y-1">
        {featureEntries.length === 0 ? (
          <p className="text-[0.7rem] text-cyan-500">No usage yet</p>
        ) : (
          featureEntries.map(([feature, data]) => (
            <div key={feature} className="flex justify-between text-[0.7rem]">
              <span className="text-cyan-300">
                {FEATURE_LABELS[feature] || feature}
              </span>
              <span className="text-cyan-200 font-editable">
                {formatCost(data.estimated_cost)}
                <span className="text-cyan-500 ml-1">({data.call_count})</span>
              </span>
            </div>
          ))
        )}
        <div className="flex justify-between text-[0.7rem] text-cyan-100 font-medium pt-1 border-t border-cyan-700/50">
          <span>Total</span>
          <span className="font-editable">{formatCost(usage.estimated_cost)}</span>
        </div>
      </div>
    </div>
  );
}
