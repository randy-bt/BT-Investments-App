"use client";

import { useState, useTransition } from "react";
import type { MarketStat } from "@/actions/market-stats";
import { updateMarketStat } from "@/actions/market-stats";

const STAT_LABELS: Record<string, string> = {
  mortgage_30yr: "30-Year Mortgage Rate (%)",
  treasury_10yr: "10-Year Treasury Yield (%)",
  sp500: "S&P 500",
  median_seattle: "Median Home Price — Seattle ($)",
  median_tacoma: "Median Home Price — Tacoma ($)",
  median_bellevue: "Median Home Price — Bellevue ($)",
};

const STAT_ORDER = [
  "mortgage_30yr",
  "treasury_10yr",
  "sp500",
  "median_seattle",
  "median_tacoma",
  "median_bellevue",
];

export function MarketStatsEditor({
  initialStats,
}: {
  initialStats: MarketStat[];
}) {
  const statsMap = new Map(initialStats.map((s) => [s.stat_key, s]));
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const key of STAT_ORDER) {
      const stat = statsMap.get(key);
      v[key] = stat && stat.value > 0 ? stat.value.toString() : "";
    }
    return v;
  });
  const [periods, setPeriods] = useState<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    for (const key of STAT_ORDER) {
      const stat = statsMap.get(key);
      p[key] = stat?.period || "";
    }
    return p;
  });
  const [sources, setSources] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const key of STAT_ORDER) {
      const stat = statsMap.get(key);
      s[key] = stat?.source || "manual";
    }
    return s;
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(key: string) {
    const val = parseFloat(values[key]);
    if (isNaN(val)) return;
    const period = periods[key];
    setSavingKey(key);
    startTransition(async () => {
      const result = await updateMarketStat(key, val, period);
      if (result.success) {
        setSources((prev) => ({ ...prev, [key]: "manual" }));
      }
      setSavingKey(null);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Daily stats (mortgage, treasury, S&amp;P) update automatically via FRED.
        Median home prices update from Redfin on the 4th Monday of each month.
        Use the fields below to manually override any value.
      </p>

      <div className="space-y-3">
        {STAT_ORDER.map((key) => (
          <div key={key} className="flex items-end gap-2">
            <label className="flex-1 block">
              <span className="text-xs text-neutral-500">
                {STAT_LABELS[key]}
                {sources[key] !== "manual" && (
                  <span className="ml-1.5 text-[0.6rem] text-neutral-400">
                    via {sources[key]}
                  </span>
                )}
              </span>
              <input
                value={values[key]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className="mt-0.5 w-full rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm font-editable"
              />
            </label>
            <label className="w-40 block">
              <span className="text-xs text-neutral-500">Period</span>
              <input
                value={periods[key]}
                onChange={(e) =>
                  setPeriods((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder="March 2026"
                className="mt-0.5 w-full rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm font-editable placeholder:text-neutral-300"
              />
            </label>
            <button
              type="button"
              onClick={() => handleSave(key)}
              disabled={isPending && savingKey === key}
              className="rounded border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-50 shrink-0"
            >
              {isPending && savingKey === key ? "..." : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
