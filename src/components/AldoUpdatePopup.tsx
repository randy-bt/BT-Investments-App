"use client";

// The Aldo update pop-up (Randy 10/8, v11 step 3). Modeled on the Enzo
// dialer's call disposition: after Aldo logs something on a lead or
// investor that sits on his board, he must say what it means for the
// line. Required: no backdrop click, no Escape, no close button. The only
// ways out are a button, or "Add a note first" after a Summarize (the
// pop-up returns when his next note posts).

import { useEffect, useState } from "react";
import { editBoardLine } from "@/actions/dashboard-notes";
import { getDealsSentForInvestor, setDealSendDeclined, type DealSentRow } from "@/actions/deal-sends";
import { buttonsFor, attemptLine, atAttemptLimit, type PopupBoard, type PopupKind, type Attempts } from "@/lib/aldo-popup";
import type { LineFlag } from "@/lib/board-line-edit";

type Props = {
  board: PopupBoard;
  entityId: string;
  entityName: string;
  kind: PopupKind;
  /** Calls and texts since last contact; acquisitions only. */
  attempts: Attempts | null;
  onDone: () => void;
};

export function AldoUpdatePopup({ board, entityId, entityName, kind, attempts, onDone }: Props) {
  const [step, setStep] = useState<"main" | "decline">("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFlag, setLastFlag] = useState<LineFlag | null>(null);
  const [deals, setDeals] = useState<DealSentRow[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  // Required pop-up: Escape does nothing.
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  async function writeFlag(flag: LineFlag) {
    setBusy(true);
    setError(null);
    setLastFlag(flag);
    const r = await editBoardLine({ module: board, name: entityName, flag });
    setBusy(false);
    if (r.success) onDone();
    else setError(r.error);
  }

  async function openDecline() {
    setBusy(true);
    setError(null);
    const r = await getDealsSentForInvestor(entityId);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    const live = r.data.filter((d) => d.page_active && !d.declined);
    setDeals(live);
    setTicked(new Set(live.length === 1 ? [live[0].send_id] : []));
    setStep("decline");
  }

  async function confirmDecline() {
    if (ticked.size === 0) return;
    setBusy(true);
    setError(null);
    for (const id of ticked) {
      const r = await setDealSendDeclined(id, true);
      if (!r.success) {
        setBusy(false);
        setError(r.error);
        return;
      }
    }
    setBusy(false);
    await writeFlag("❌");
  }

  const buttons = buttonsFor(board);
  const isAcq = board === "acquisitions_b";
  const limit = attempts ? atAttemptLimit(attempts) : false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Update for your board">
      <div className="w-full max-w-lg rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-xl dark:border-neutral-600 dark:bg-neutral-900">
        {step === "main" ? (
          <>
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-neutral-400">{isAcq ? "AACQ board" : "Dispositions board"}</div>
              <h2 className="text-base font-medium text-neutral-800 dark:text-neutral-100">What does this mean for {entityName}&apos;s line?</h2>
              {isAcq && attempts && (
                <p className={`mt-1 text-xs ${limit ? "font-medium text-orange-600 dark:text-orange-400" : "text-neutral-500"}`}>
                  {attemptLine(attempts)}
                  {limit && " · 📆 is the expected pick"}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onDone}
              className="w-full rounded-md border border-neutral-300 bg-neutral-100 px-4 py-4 text-lg font-medium text-neutral-800 hover:bg-neutral-200 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              ➡️ No update
            </button>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {buttons.map((b) => (
                <button
                  key={b.flag}
                  type="button"
                  disabled={busy}
                  onClick={() => (b.declineStep ? openDecline() : writeFlag(b.flag))}
                  className="flex flex-col items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-3 text-center hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                >
                  <span className="text-2xl leading-none">{b.flag}</span>
                  <span className="text-[0.7rem] leading-tight text-neutral-600 dark:text-neutral-300">{b.label}</span>
                </button>
              ))}
            </div>

            {kind === "summary" && (
              <div className="mt-3 text-center">
                <button type="button" disabled={busy} onClick={onDone} className="text-xs text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400">
                  ✏️ Add a note first
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-base font-medium text-neutral-800 dark:text-neutral-100">Which deal did {entityName} decline?</h2>
            {deals && deals.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">No live deals are on {entityName}&apos;s record. Go back and pick another answer.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {(deals ?? []).map((d) => (
                  <li key={d.send_id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                      <input
                        type="checkbox"
                        checked={ticked.has(d.send_id)}
                        onChange={(e) => {
                          const next = new Set(ticked);
                          if (e.target.checked) next.add(d.send_id);
                          else next.delete(d.send_id);
                          setTicked(next);
                        }}
                      />
                      <span className="text-neutral-800 dark:text-neutral-100">{d.address}</span>
                      <span className="ml-auto text-xs text-neutral-400">{d.price}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" disabled={busy} onClick={() => setStep("main")} className="text-xs text-neutral-500 underline hover:text-neutral-700">
                Back
              </button>
              <button
                type="button"
                disabled={busy || ticked.size === 0}
                onClick={confirmDecline}
                className="rounded-md border border-neutral-800 bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
              >
                ❌ Confirm declined
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
            <span>{error}</span>
            {lastFlag && (
              <button type="button" disabled={busy} onClick={() => writeFlag(lastFlag)} className="ml-3 underline">
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
