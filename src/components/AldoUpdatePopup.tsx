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
import {
  buttonsFor,
  attemptLine,
  atAttemptLimit,
  investorAttemptLine,
  investorUnreachableUnlocked,
  investorUnreachableNeeds,
  type PopupBoard,
  type PopupKind,
  type Attempts,
} from "@/lib/aldo-popup";
import type { LineFlag } from "@/lib/board-line-edit";

// Tinted tiles, one tone per answer: the colour carries the meaning so
// the row reads at a glance. Light: pale fill, dark: 10% fill.
const TILE_TINT: Record<LineFlag, string> = {
  "✅": "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20",
  "⚠️": "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20",
  "❌": "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20",
  "📆": "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20",
  "🫥": "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-500/20 dark:bg-neutral-500/10 dark:text-neutral-200 dark:hover:bg-neutral-500/20",
};

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
  // Investors (Randy 10/9): 🫥 stays locked until five calls and one
  // voicemail since last contact.
  const ghostUnlocked = attempts ? investorUnreachableUnlocked(attempts) : false;
  const ghostNeeds = attempts ? investorUnreachableNeeds(attempts) : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Mark the result">
      <div className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        {step === "main" ? (
          <div className="space-y-5">
            <header className="space-y-1.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">{isAcq ? "AACQ board" : "Dispositions board"}</p>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Mark the result</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-200">{entityName}</span>
                {isAcq && attempts && (
                  <>
                    <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                    <span className={limit ? "font-medium text-amber-600 dark:text-amber-400" : ""}>{attemptLine(attempts)}</span>
                    {limit && <span className="ml-1.5 text-amber-600 dark:text-amber-400">📆 expected</span>}
                  </>
                )}
                {!isAcq && attempts && (
                  <>
                    <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                    <span className={ghostUnlocked ? "font-medium text-amber-600 dark:text-amber-400" : ""}>{investorAttemptLine(attempts)}</span>
                    {ghostUnlocked && <span className="ml-1.5 text-amber-600 dark:text-amber-400">🫥 expected</span>}
                  </>
                )}
              </p>
            </header>

            <button
              type="button"
              disabled={busy}
              onClick={onDone}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-100 px-4 py-4 text-base font-semibold text-neutral-800 transition hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              <span aria-hidden>➡️</span> No update
            </button>

            <div className="grid grid-cols-4 gap-3">
              {buttons.map((b) => {
                const locked = b.flag === "🫥" && !ghostUnlocked;
                return (
                  <button
                    key={b.flag}
                    type="button"
                    disabled={busy || locked}
                    aria-disabled={locked || undefined}
                    title={locked ? ghostNeeds : undefined}
                    onClick={() => (b.declineStep ? openDecline() : writeFlag(b.flag))}
                    className={`flex min-h-[7.25rem] flex-col items-center justify-start gap-2.5 rounded-2xl border px-2 pt-4 pb-3 text-center transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed ${TILE_TINT[b.flag]}`}
                  >
                    <span className="text-[2rem] leading-none drop-shadow-sm">{b.flag}</span>
                    <span className="text-[0.72rem] font-semibold leading-snug">{b.label}</span>
                    {locked && <span className="text-[0.62rem] leading-tight opacity-80">{ghostNeeds.replace("Needs ", "").replace(" since last contact", "")}</span>}
                  </button>
                );
              })}
            </div>

            {kind === "summary" && (
              <div className="text-center">
                <button type="button" disabled={busy} onClick={onDone} className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">
                  ✏️ Add a note first
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <header className="space-y-1.5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">Dispositions board</p>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Which deal did {entityName} decline?</h2>
            </header>
            {deals && deals.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No live deals are on {entityName}&apos;s record. Go back and pick another answer.</p>
            ) : (
              <ul className="space-y-2">
                {(deals ?? []).map((d) => (
                  <li key={d.send_id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-sm transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
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
            <div className="flex items-center justify-between">
              <button type="button" disabled={busy} onClick={() => setStep("main")} className="rounded-full px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100">
                Back
              </button>
              <button
                type="button"
                disabled={busy || ticked.size === 0}
                onClick={confirmDecline}
                className="rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-40"
              >
                ❌ Confirm declined
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
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
