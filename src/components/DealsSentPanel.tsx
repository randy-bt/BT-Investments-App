"use client";

import { useEffect, useState, useTransition } from "react";
import { getDealsSentForInvestor, setDealSendDeclined, type DealSentRow } from "@/actions/deal-sends";
import { dealUrl } from "@/lib/deal-url";
import type { ListingPageType } from "@/lib/types";

function formatRelative(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: string) {
  const p = price.trim();
  return p.startsWith("$") ? p : `$${p}`;
}

export function DealsSentPanel({ investorId }: { investorId: string }) {
  const [rows, setRows] = useState<DealSentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startPending] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getDealsSentForInvestor(investorId);
      if (cancelled) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [investorId]);

  function toggleDeclined(sendId: string, current: boolean) {
    setRows((prev) =>
      prev ? prev.map((r) => (r.send_id === sendId ? { ...r, declined: !current } : r)) : prev
    );
    startPending(async () => {
      const result = await setDealSendDeclined(sendId, !current);
      if (!result.success) {
        alert("Could not update: " + result.error);
        setRows((prev) =>
          prev ? prev.map((r) => (r.send_id === sendId ? { ...r, declined: current } : r)) : prev
        );
      }
    });
  }

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Could not load deals sent: {error}</p>;
  if (rows === null) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Deals Sent <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">({rows.length})</span>
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
          No deals yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            // Green = a live opportunity (page still active AND not declined).
            // Grey = declined OR no longer available.
            const isGreen = row.page_active && !row.declined;
            const rowClass = isGreen
              ? "border-l-4 border-[#42501f] bg-[#ebeee0] dark:bg-[#2a2f1c]"
              : "border-l-4 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900";
            const dateClass = isGreen
              ? "font-semibold text-[#42501f] dark:text-[#c5cca8]"
              : "text-neutral-500 dark:text-neutral-400";
            const rowContent = (
              <>
                <div className="min-w-0">
                  <span className={`text-sm ${isGreen ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-medium text-neutral-700 dark:text-neutral-200"}`}>
                    {row.address}
                  </span>
                  {row.price && (
                    <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">{formatPrice(row.price)}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {row.declined && (
                    <span className="rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-300">
                      Declined{row.declined_at ? ` ${formatRelative(row.declined_at)}` : ""}
                    </span>
                  )}
                  {!row.page_active && (
                    <span className="rounded-full bg-neutral-200 dark:bg-neutral-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-300">
                      No longer available
                    </span>
                  )}
                  <span className={`text-xs ${dateClass}`}>
                    Sent {formatRelative(row.sent_at)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleDeclined(row.send_id, row.declined);
                    }}
                    title={row.declined ? "Marked declined — click to undo" : "Mark as declined"}
                    aria-label={row.declined ? "Undo declined" : "Mark as declined"}
                    className={`rounded px-1 text-sm font-semibold leading-none ${
                      row.declined
                        ? "text-red-600 dark:text-red-400"
                        : "text-neutral-300 hover:text-neutral-400 dark:text-neutral-600 dark:hover:text-neutral-500"
                    }`}
                  >
                    ✕
                  </button>
                </div>
              </>
            );
            const rowClasses = `flex items-center justify-between gap-3 rounded-md px-3 py-2.5 ${rowClass}`;
            return row.page_active ? (
              <a
                key={row.send_id}
                href={dealUrl(row.slug, row.page_type as ListingPageType)}
                target="_blank"
                rel="noreferrer"
                title="Open live marketing page"
                className={`${rowClasses} transition-transform duration-150 hover:scale-[1.02]`}
              >
                {rowContent}
              </a>
            ) : (
              <div key={row.send_id} className={rowClasses}>
                {rowContent}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
