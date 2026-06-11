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

function formatPrice(price: string) {
  const p = price.trim();
  return p.startsWith("$") ? p : `$${p}`;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recording, startRecording] = useTransition();

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

  const matched = (rows ?? []).filter((r) => r.is_match);
  const others = (rows ?? []).filter((r) => !r.is_match);
  const sent = matched.filter((r) => r.sent_at !== null);
  const notSent = matched.filter((r) => r.sent_at === null);
  const othersNotSent = others.filter((r) => r.sent_at === null);
  const othersSent = others.filter((r) => r.sent_at !== null);

  function toggleSelect(investorId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(investorId)) next.delete(investorId);
      else next.add(investorId);
      return next;
    });
  }

  function toggleSelectGroup(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.length > 0 && ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleUnmark(investorId: string) {
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.investor.id === investorId ? { ...r, sent_at: null } : r
          )
        : prev
    );
    startRecording(async () => {
      const result = await unmarkSent(listingPageId, investorId);
      if (!result.success) {
        alert("Could not unmark: " + result.error);
        return;
      }
      onSentChange?.();
    });
  }

  function handleRecord() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startRecording(async () => {
      const results = await Promise.all(ids.map((id) => markSent(listingPageId, id)));
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        alert("Some records failed: " + (failed[0] as { success: false; error: string }).error);
      }
      setSelected(new Set());
      const refreshed = await getMatchingInvestors(listingPageId, { showAll });
      if (refreshed.success) setRows(refreshed.data);
      onSentChange?.();
    });
  }

  function handleComingSoon(channel: string) {
    if (selected.size === 0) return;
    alert(`${channel} sending is coming soon — it will send to the selected investors and record automatically. For now, use "Record only".`);
  }

  const n = selected.size;
  const notSentIds = notSent.map((r) => r.investor.id);
  const othersNotSentIds = othersNotSent.map((r) => r.investor.id);
  const allMatchedSelected = notSentIds.length > 0 && notSentIds.every((id) => selected.has(id));
  const allOthersSelected = othersNotSentIds.length > 0 && othersNotSentIds.every((id) => selected.has(id));

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
              <div className="mt-0.5 text-xs opacity-90">{address} — {formatPrice(price)}</div>
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
              checked
              onCheck={() => handleUnmark(row.investor.id)}
            />
          ))}
          {notSent.length > 0 && (
            <div className="flex items-center gap-2 border-y border-[#e6d573] bg-[#fff8d6] dark:bg-[#332e10] px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b5500] dark:text-[#e6d573]">
              <input
                type="checkbox"
                checked={allMatchedSelected}
                onChange={() => toggleSelectGroup(notSentIds)}
                className="accent-[#5c6e2d]"
                aria-label="Select all matching investors"
              />
              <span>Not sent yet — select all</span>
            </div>
          )}
          {notSent.map((row) => (
            <Row
              key={row.investor.id}
              row={row}
              checked={selected.has(row.investor.id)}
              onCheck={() => toggleSelect(row.investor.id)}
            />
          ))}
          {showAll && others.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-y border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {othersNotSentIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allOthersSelected}
                    onChange={() => toggleSelectGroup(othersNotSentIds)}
                    className="accent-[#5c6e2d]"
                    aria-label="Select all other investors"
                  />
                )}
                <span>All other investors — no location match{othersNotSentIds.length > 0 ? " — select all" : ""}</span>
              </div>
              {othersSent.map((row) => (
                <Row
                  key={row.investor.id}
                  row={row}
                  checked
                  onCheck={() => handleUnmark(row.investor.id)}
                  dim
                />
              ))}
              {othersNotSent.map((row) => (
                <Row
                  key={row.investor.id}
                  row={row}
                  checked={selected.has(row.investor.id)}
                  onCheck={() => toggleSelect(row.investor.id)}
                  dim
                />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-5 py-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {n === 0 ? "Select investors to record or send" : `${n} selected`}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={handleRecord}
              disabled={n === 0 || recording}
              className="whitespace-nowrap rounded-md bg-[#42501f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#36421a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Record only ({n})
            </button>
            <button
              onClick={() => handleComingSoon("SMS")}
              disabled={n === 0}
              className="whitespace-nowrap rounded-md border border-[#42501f] px-3 py-1.5 text-xs font-semibold text-[#42501f] dark:text-[#c5cca8] dark:border-[#c5cca8] hover:bg-[#42501f]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              SMS ({n})
            </button>
            <button
              onClick={() => handleComingSoon("Email")}
              disabled={n === 0}
              className="whitespace-nowrap rounded-md border border-[#42501f] px-3 py-1.5 text-xs font-semibold text-[#42501f] dark:text-[#c5cca8] dark:border-[#c5cca8] hover:bg-[#42501f]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Email ({n})
            </button>
            <button
              onClick={() => handleComingSoon("SMS & email")}
              disabled={n === 0}
              className="whitespace-nowrap rounded-md border border-[#42501f] px-3 py-1.5 text-xs font-semibold text-[#42501f] dark:text-[#c5cca8] dark:border-[#c5cca8] hover:bg-[#42501f]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              SMS &amp; Email ({n})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  checked,
  onCheck,
  dim = false,
}: {
  row: MatchingInvestorRow;
  checked: boolean;
  onCheck: () => void;
  dim?: boolean;
}) {
  const sent = row.sent_at !== null;
  const interestsLabel = row.location_interests.length === 0
    ? "No locations set"
    : row.location_interests.map((l) => l.name).join(", ");
  const showMatchNote =
    row.is_match && row.match_location_name && row.match_location_kind && row.match_location_kind !== "city";
  return (
    <div
      className={`flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-5 py-2.5 ${
        dim
          ? "bg-neutral-50 dark:bg-neutral-950 opacity-55"
          : sent
            ? "bg-white dark:bg-neutral-900"
            : "bg-[#fffdf0] dark:bg-[#1a1a0e]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        className="shrink-0 scale-125 accent-[#5c6e2d]"
        aria-label={sent ? `Unmark ${row.investor.name}` : `Select ${row.investor.name}`}
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
