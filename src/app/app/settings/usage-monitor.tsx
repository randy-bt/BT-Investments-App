"use client";

import { useState } from "react";
import type { UsageStats, FixedCostItem, ProviderUsage } from "@/actions/usage-stats";
import { saveFixedCosts } from "@/actions/usage-stats";
import type { ProviderBilling } from "@/lib/billing";

const FEATURE_LABELS: Record<string, string> = {
  news_scoring: "News Scoring",
  news_summary: "News Summarizer",
  news_headlines: "Headline Shortener",
  call_summary: "Call Summarizer",
  transcription: "Transcription",
  transcription_backfill: "Transcript Backfill",
  listing_page: "Listing Page Generator",
  property_scrape: "Property Scraper",
  news_tts: "News Read Aloud",
  lead_up_next_brief: "Deal Snapshots",
  lead_marketing_one_liner: "Marketing One-Liner",
  lead_ai_review: "Lead AI Review",
  indica_chat: "Indica Chat",
  daily_digest: "Daily Digest",
  agreement_review: "Contract Review",
  jv_extract: "JV Email Extraction",
  sms_send: "SMS Sends",
  email_send: "Email Sends",
  form_notification: "Form Notifications",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  quo: "Quo (SMS)",
  resend: "Resend (Email)",
};

function formatCost(n: number): string {
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

type Period = "today" | "last30" | "allTime";
const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  last30: "Last 30 Days",
  allTime: "All Time",
};

export function UsageMonitor({
  initialStats,
  isAdmin = false,
}: {
  initialStats: UsageStats | null;
  isAdmin?: boolean;
}) {
  const [stats] = useState<UsageStats | null>(initialStats);
  const [period, setPeriod] = useState<Period>("last30");

  if (!stats) {
    return <p className="text-sm text-neutral-400">Failed to load usage data.</p>;
  }

  const usage = stats[period];
  const providers = Object.entries(usage).sort(
    ([, a], [, b]) => b.estimated_cost - a.estimated_cost
  );
  const meteredTotal = providers.reduce((s, [, p]) => s + p.estimated_cost, 0);

  // "True monthly cost" = this calendar month's metered API spend + the
  // fixed subscriptions. The most honest single number we can show.
  const currentMonthMetered = stats.monthlyCosts[0]?.cost ?? 0;
  const trueMonthly = currentMonthMetered + stats.fixedCosts.totalMonthly;

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

      {/* API usage per provider — every provider with logs, no hardcoding */}
      {providers.length === 0 ? (
        <p className="text-sm text-neutral-400">No usage in this period.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {providers.map(([name, p]) => (
            <ProviderCard key={name} name={PROVIDER_LABELS[name] || name} usage={p} />
          ))}
        </div>
      )}

      {/* Metered total for the selected period */}
      <div className="flex items-center justify-between rounded border border-neutral-400 px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-600">
          API / Usage Cost ({PERIOD_LABELS[period]})
        </span>
        <span className="text-sm font-bold font-editable">{formatCost(meteredTotal)}</span>
      </div>

      {/* Monthly metered history */}
      {stats.monthlyCosts.length > 0 && (
        <div className="space-y-1">
          {stats.monthlyCosts.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between rounded border border-dashed border-neutral-300 px-4 py-2"
            >
              <span className="text-xs text-neutral-500">API Cost ({m.label})</span>
              <span className="text-sm font-semibold font-editable">{formatCost(m.cost)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actual billed costs from provider billing APIs (org-wide) */}
      {Object.keys(stats.billing).length > 0 && (
        <BilledActual billing={stats.billing} last30={stats.last30} />
      )}

      {/* Fixed monthly costs (subscriptions) + the true total */}
      <FixedCosts initial={stats.fixedCosts.items} editable={isAdmin} />
      <div className="flex items-center justify-between rounded border-2 border-neutral-700 px-4 py-3 dark:border-neutral-300">
        <div>
          <span className="block text-xs font-semibold text-neutral-700 dark:text-neutral-200">
            Total Cost to Run (this month)
          </span>
          <span className="block text-[0.65rem] text-neutral-400">
            {formatCost(currentMonthMetered)} API usage + {formatCost(stats.fixedCosts.totalMonthly)} subscriptions
          </span>
        </div>
        <span className="text-lg font-bold font-editable">{formatCost(trueMonthly)}</span>
      </div>
    </div>
  );
}

// Real invoiced amounts pulled from Anthropic/OpenAI billing APIs. These are
// ORG-WIDE (every app on the account), so alongside each we show this app's
// estimated share of that bill for the same trailing-30-day window.
function BilledActual({
  billing,
  last30,
}: {
  billing: Record<string, ProviderBilling>;
  last30: Record<string, ProviderUsage>;
}) {
  const entries = Object.entries(billing).sort(([, a], [, b]) => b.last30 - a.last30);
  const syncedAt = entries[0]?.[1]?.syncedAt;

  return (
    <div className="rounded border border-amber-600/40 bg-amber-50/50 px-4 py-3 space-y-2 dark:bg-amber-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
          Actual API Spend — entire account, all apps (last 30 days)
        </span>
        {syncedAt && (
          <span className="text-[0.6rem] text-amber-600/70 dark:text-amber-400/60">
            synced {new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {entries.map(([provider, b]) => {
          const appEstimate = last30[provider]?.estimated_cost ?? 0;
          const share = b.last30 > 0 ? (appEstimate / b.last30) * 100 : 0;
          return (
            <div key={provider} className="flex items-center justify-between text-[0.75rem]">
              <span className="text-amber-900 dark:text-amber-200">
                {PROVIDER_LABELS[provider] || provider}
              </span>
              <span className="text-amber-900 dark:text-amber-200">
                <span className="font-editable font-semibold">{formatCost(b.last30)}</span>
                <span className="ml-2 text-[0.65rem] text-amber-700/80 dark:text-amber-400/70">
                  this app ≈ {formatCost(appEstimate)} ({share < 1 && share > 0 ? "<1" : Math.round(share)}%)
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[0.6rem] leading-snug text-amber-700/70 dark:text-amber-400/60">
        Real paid API usage across every app on the account (Anthropic figure is
        measured from Anthropic&apos;s own token reports and excludes Claude Code
        usage covered by the flat Claude subscription). This app&apos;s share is
        shown next to each. Refreshes every ~6 hours when this page loads.
      </p>
    </div>
  );
}

function FixedCosts({ initial, editable }: { initial: FixedCostItem[]; editable: boolean }) {
  const [items, setItems] = useState<FixedCostItem[]>(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FixedCostItem[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const clean = draft.filter((d) => d.label.trim() !== "");
    const res = await saveFixedCosts(clean);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setItems(clean);
    setEditing(false);
  }

  return (
    <div className="rounded border border-dashed border-neutral-300 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-600">
          Fixed Monthly Costs (subscriptions, domains…)
        </span>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(
                items.length > 0
                  ? items.map((i) => ({ ...i }))
                  : [{ label: "", monthly: 0, active: true }]
              );
              setEditing(true);
            }}
            className="text-[0.65rem] text-neutral-400 hover:text-neutral-600"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        items.length === 0 ? (
          <p className="text-[0.7rem] text-neutral-400">
            None set — add your subscriptions (Quo, Google Workspace, ElevenLabs, domains…) so the
            total below reflects the real cost to run.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((i, idx) => (
              <div
                key={idx}
                className={`flex justify-between text-[0.75rem] ${i.active ? "" : "opacity-40"}`}
              >
                <span className="text-neutral-500">
                  {i.label}
                  {!i.active && <span className="ml-1.5 text-[0.6rem] uppercase">(inactive)</span>}
                </span>
                <span className={`font-editable ${i.active ? "" : "line-through"}`}>
                  {formatCost(i.monthly)}/mo
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {draft.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {/* Active toggle pill — green = counts toward the total */}
              <button
                type="button"
                role="switch"
                aria-checked={d.active}
                onClick={() =>
                  setDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, active: !x.active } : x)))
                }
                title={d.active ? "Active — counted in total" : "Inactive — not counted"}
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                  d.active ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
                    d.active ? "left-3.5" : "left-0.5"
                  }`}
                />
              </button>
              <input
                type="text"
                value={d.label}
                onChange={(e) =>
                  setDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                }
                placeholder="e.g. Quo subscription"
                className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
              />
              <span className="text-xs text-neutral-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={d.monthly}
                onChange={(e) =>
                  setDraft((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, monthly: Number(e.target.value) } : x))
                  )
                }
                className="w-20 rounded border border-neutral-300 px-2 py-1 text-xs"
              />
              <span className="text-[0.65rem] text-neutral-400">/mo</span>
              <button
                type="button"
                onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                className="text-xs text-red-400 hover:text-red-600"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          {error && <p className="text-[0.7rem] text-red-600">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDraft((prev) => [...prev, { label: "", monthly: 0, active: true }])}
              className="rounded border border-neutral-300 px-2 py-0.5 text-[0.65rem] text-neutral-500 hover:bg-neutral-50"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded bg-neutral-800 px-2.5 py-0.5 text-[0.65rem] text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[0.65rem] text-neutral-400 hover:text-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ name, usage }: { name: string; usage: ProviderUsage }) {
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
              <span className="text-cyan-300">{FEATURE_LABELS[feature] || feature}</span>
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
