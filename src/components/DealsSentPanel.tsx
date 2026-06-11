"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDealsSentForInvestor, type DealSentRow } from "@/actions/deal-sends";

function formatRelative(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DealsSentPanel({ investorId }: { investorId: string }) {
  const [rows, setRows] = useState<DealSentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Could not load deals sent: {error}</p>;
  if (rows === null) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Deals Sent <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">({rows.length})</span>
        </h3>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Auto-tracked when &ldquo;sent&rdquo; is ticked</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
          No deals sent yet. Tick &ldquo;sent&rdquo; on the matching popup to start tracking.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => {
            const isNewest = idx === 0;
            const borderClass = isNewest
              ? "border-l-4 border-[#5D3954] bg-[#ebeee0] dark:bg-[#2a2f1c]"
              : "border-l-4 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900";
            return (
              <Link
                key={row.send_id}
                href={`/app/marketing-page-creator/edit/${row.listing_page_id}`}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 ${borderClass} hover:opacity-90`}
              >
                <div>
                  <span className={`text-sm ${isNewest ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-medium text-neutral-700 dark:text-neutral-200"}`}>
                    {row.address}
                  </span>
                  {row.price && (
                    <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">${row.price}</span>
                  )}
                </div>
                <span className={`text-xs ${isNewest ? "font-semibold text-[#5D3954] dark:text-[#b890ac]" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {formatRelative(row.sent_at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-4 rounded-md border-l-2 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        <strong className="text-neutral-900 dark:text-neutral-100">Track responses in Notes.</strong>{" "}
        This panel only records what was sent and when. Yes/no/maybe replies still go in the Notes section above.
      </p>
    </div>
  );
}
