"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getMatchingInvestors,
  markSent,
  unmarkSent,
  type MatchingInvestorRow,
} from "@/actions/deal-sends";

function formatRelative(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FindInvestorsDialog({
  listingPageId,
  address,
  price,
  onClose,
  onSentChange,
}: {
  listingPageId: string;
  address: string;
  price: string;
  onClose: () => void;
  onSentChange?: () => void;
}) {
  const [rows, setRows] = useState<MatchingInvestorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [, startToggle] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getMatchingInvestors(listingPageId, { showAll });
      if (cancelled) return;
      if (result.success) setRows(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [listingPageId, showAll]);

  function handleToggle(investorId: string, currentlySent: boolean) {
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.investor.id === investorId
              ? { ...r, sent_at: currentlySent ? null : new Date().toISOString() }
              : r
          )
        : prev
    );
    startToggle(async () => {
      const action = currentlySent ? unmarkSent : markSent;
      const result = await action(listingPageId, investorId);
      if (!result.success) {
        alert("Save failed: " + result.error);
        setRows((prev) =>
          prev
            ? prev.map((r) =>
                r.investor.id === investorId
                  ? { ...r, sent_at: currentlySent ? new Date().toISOString() : null }
                  : r
              )
            : prev
        );
        return;
      }
      onSentChange?.();
    });
  }

  const matched = (rows ?? []).filter((r) => r.is_match);
  const others = (rows ?? []).filter((r) => !r.is_match);
  const sent = matched.filter((r) => r.sent_at !== null);
  const notSent = matched.filter((r) => r.sent_at === null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#42501f] px-5 py-3.5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">📨 Investors matching this deal</div>
              <div className="mt-0.5 text-xs opacity-90">{address} — ${price}</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-2xl leading-none opacity-80 hover:opacity-100">×</button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-[#ebeee0] dark:bg-[#2a2f1c] px-5 py-2.5 text-xs text-neutral-900 dark:text-neutral-100">
          <div>
            <strong>{sent.length} of {matched.length} sent</strong>
            {notSent.length > 0 && (
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">{notSent.length} still to go</span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[#5c6e2d]"
            />
            <span>Show all investors</span>
          </label>
        </div>

        {error && (
          <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {showAll
              ? "No active investors."
              : "This deal isn't linked to any locations yet, or no investors match. Add locations on the edit page to find matches."}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {sent.map((row) => (
            <Row
              key={row.investor.id}
              row={row}
              onToggle={() => handleToggle(row.investor.id, true)}
            />
          ))}
          {notSent.length > 0 && (
            <div className="border-y border-[#e6d573] bg-[#fff8d6] dark:bg-[#332e10] px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b5500] dark:text-[#e6d573]">
              Not sent yet
            </div>
          )}
          {notSent.map((row) => (
            <Row
              key={row.investor.id}
              row={row}
              onToggle={() => handleToggle(row.investor.id, false)}
            />
          ))}
          {showAll && others.length > 0 && (
            <>
              <div className="border-y border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                All other investors — no location match
              </div>
              {others.map((row) => (
                <Row
                  key={row.investor.id}
                  row={row}
                  onToggle={() => handleToggle(row.investor.id, row.sent_at !== null)}
                />
              ))}
            </>
          )}
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-5 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
          Changes save automatically.
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  onToggle,
}: {
  row: MatchingInvestorRow;
  onToggle: () => void;
}) {
  const sent = row.sent_at !== null;
  const interestsLabel = row.location_interests.length === 0
    ? "No locations set"
    : row.location_interests.map((l) => l.name).join(", ");
  const showMatchNote =
    row.is_match && row.match_location_name && row.match_location_kind && row.match_location_kind !== "city";
  return (
    <div
      className={`flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-5 py-2.5 ${sent ? "bg-white dark:bg-neutral-900" : "bg-[#fffdf0] dark:bg-[#1a1a0e]"}`}
    >
      <input
        type="checkbox"
        checked={sent}
        onChange={onToggle}
        className="shrink-0 scale-125 accent-[#5c6e2d]"
        aria-label={`Mark ${row.investor.name} as sent`}
      />
      <span className="shrink-0 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {row.investor.name}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
        Wants: {interestsLabel}
        {showMatchNote && (
          <span className="text-[#5c6e2d] dark:text-[#c5cca8]"> · Matched on {row.match_location_name}</span>
        )}
      </span>
      {sent && row.sent_at && (
        <span className="shrink-0 text-xs font-semibold text-[#5c6e2d] dark:text-[#c5cca8]">
          Sent {formatRelative(row.sent_at)}
        </span>
      )}
    </div>
  );
}
