"use client";

// THE ONE PLACE IN THE APP THAT SENDS (dispositions rebuild stage 3, Randy
// Oct 2 2026). Three steps, in his words "nothing ever happens on accident":
//
//   1  who      the picker, in the FindInvestorsDialog look he likes -
//               checkboxes, already-sent and unreachable unchecked by default
//   2  what     the exact text and the exact email, subject + body +
//               signature, as the investors will see them
//   3  confirm  "Send X texts and Y emails?" with the real channel counts,
//               and a PRESS-AND-HOLD button: 3 seconds with a visible fill,
//               release early and nothing happens. There is no single-click
//               path to sending anywhere in this file.
//
// Behind it is sendQueueRow, unchanged: Quo text + aldo@ email with
// signature, the consolidated investor update, Aldo's 💰🟢 line, the move to
// Active, the atomic ready->sending claim, and the no-page rule.

import { useCallback, useEffect, useRef, useState } from "react";
import { Overlay } from "@/components/dispo/DispoQueuePanel";
import { getQueueRecipients, sendQueueRow, type DispoQueueRow, type QueueRecipient } from "@/actions/dispo";
import { signatureFor } from "@/lib/email-signatures";
import {
  channelCounts,
  confirmLabel,
  defaultSelection,
  holdProgress,
  reachable,
} from "@/lib/dispo/send-flow";

const ALDO_FROM = "aldo@btinvestments.co";

type Step = 1 | 2 | 3;

export function SendFlow({
  row,
  onClose,
  onSent,
}: {
  row: DispoQueueRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [recipients, setRecipients] = useState<QueueRecipient[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number; failedCount: number;
    partial: Array<{ name: string; missed: string }>; warnings: string[];
  } | null>(null);

  // "Show all investors" reveals everyone beneath the matches, to be
  // hand-picked (the old FindInvestorsDialog shape Randy asked to keep).
  const [showAll, setShowAll] = useState(false);
  const defaulted = useRef(false);

  useEffect(() => {
    getQueueRecipients(row.id, { showAll }).then((r) => {
      if (!r.success) { setError(r.error); return; }
      setRecipients(r.data);
      // Defaults are set ONCE, from the matches. Toggling show-all must not
      // reset what Randy has already ticked or unticked.
      if (!defaulted.current) {
        defaulted.current = true;
        setChecked(defaultSelection(r.data));
      }
    });
  }, [row.id, showAll]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const counts = channelCounts(recipients ?? [], checked);

  const fire = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const r = await sendQueueRow(row.id, Array.from(checked));
    setSending(false);
    if (!r.success) { setError(r.error); return; }
    setResult({
      sent: r.data.sent,
      failedCount: r.data.failed.length,
      partial: r.data.partial.map((x) => ({ name: x.name, missed: x.missed })),
      warnings: r.data.warnings,
    });
  }, [row.id, checked, sending]);

  const sig = signatureFor(ALDO_FROM);

  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Send · {row.deal_name}
          {!result && <span className="ml-3 text-xs font-normal text-neutral-400">step {step} of 3</span>}
        </h3>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700">✕</button>
      </div>

      {result ? (
        <Done result={result} onDone={onSent} />
      ) : step === 1 ? (
        <Picker
          recipients={recipients}
          checked={checked}
          error={error}
          showAll={showAll}
          onShowAll={setShowAll}
          onToggle={toggle}
          onSelectGroup={(ids, on) =>
            setChecked((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
              return next;
            })
          }
          onNext={() => setStep(2)}
        />
      ) : step === 2 ? (
        <Preview
          row={row}
          people={counts.people}
          signatureText={sig?.text ?? null}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : (
        <Confirm
          label={confirmLabel(counts)}
          people={counts.people}
          sending={sending}
          error={error}
          onBack={() => setStep(2)}
          onFire={fire}
        />
      )}
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Step 1 - who. The FindInvestorsDialog look: the row treatment, the yellow
// "not sent yet" band, the bounced pill, the "Sent <date>" tag.
// ---------------------------------------------------------------------------

function Picker({
  recipients, checked, error, showAll, onShowAll, onToggle, onSelectGroup, onNext,
}: {
  recipients: QueueRecipient[] | null;
  checked: Set<string>;
  error: string | null;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
  onToggle: (id: string) => void;
  onSelectGroup: (ids: string[], on: boolean) => void;
  onNext: () => void;
}) {
  const all = recipients ?? [];
  const matches = all.filter((r) => r.is_match);
  const others = all.filter((r) => !r.is_match);
  const fresh = matches.filter((r) => !r.already_sent_at);
  const prior = matches.filter((r) => r.already_sent_at);
  const freshReachable = fresh.filter(reachable).map((r) => r.investor_id);
  const allFresh = freshReachable.length > 0 && freshReachable.every((id) => checked.has(id));
  const othersReachable = others.filter((r) => reachable(r) && !r.already_sent_at).map((r) => r.investor_id);
  const allOthers = othersReachable.length > 0 && othersReachable.every((id) => checked.has(id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Everyone checked gets the text and the email. Uncheck anyone to leave out.
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => onShowAll(e.target.checked)}
            className="accent-[#5c6e2d]"
          />
          Show all investors
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!recipients && !error && <p className="text-sm text-neutral-400">Loading investors…</p>}
      {recipients && recipients.length === 0 && (
        <p className="text-sm text-neutral-400">No matched investors for this deal.</p>
      )}

      {recipients && recipients.length > 0 && (
        <div className="max-h-80 overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-800">
          {fresh.length > 0 && (
            <div className="flex items-center gap-2 border-b border-[#e6d573] bg-[#fff8d6] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b5500] dark:bg-[#332e10] dark:text-[#e6d573]">
              <input
                type="checkbox"
                checked={allFresh}
                onChange={() => onSelectGroup(freshReachable, !allFresh)}
                className="accent-[#5c6e2d]"
                aria-label="Select all not sent yet"
              />
              <span>Not sent yet · select all</span>
            </div>
          )}
          {fresh.map((r) => <Row key={r.investor_id} r={r} checked={checked.has(r.investor_id)} onToggle={onToggle} />)}
          {prior.length > 0 && (
            <div className="border-y border-neutral-300 bg-neutral-100 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
              Already sent this deal · unchecked unless you re-check them
            </div>
          )}
          {prior.map((r) => <Row key={r.investor_id} r={r} checked={checked.has(r.investor_id)} onToggle={onToggle} dim />)}
          {showAll && others.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-y border-neutral-300 bg-neutral-100 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                {othersReachable.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allOthers}
                    onChange={() => onSelectGroup(othersReachable, !allOthers)}
                    className="accent-[#5c6e2d]"
                    aria-label="Select all other investors"
                  />
                )}
                <span>All other investors · no location match{othersReachable.length > 0 ? " · select all" : ""}</span>
              </div>
              {others.map((r) => <Row key={r.investor_id} r={r} checked={checked.has(r.investor_id)} onToggle={onToggle} dim />)}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
        <span className="text-xs text-neutral-500">{checked.size} selected</span>
        <button
          onClick={onNext}
          disabled={checked.size === 0}
          className="rounded-md bg-[#5c6e2d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#4d5c26] disabled:opacity-40"
        >
          Next: preview →
        </button>
      </div>
    </div>
  );
}

function Row({ r, checked, onToggle, dim = false }: {
  r: QueueRecipient; checked: boolean; onToggle: (id: string) => void; dim?: boolean;
}) {
  const ok = reachable(r);
  return (
    <label
      className={`flex items-center gap-3 border-b border-neutral-200 px-4 py-2.5 last:border-0 dark:border-neutral-800 ${
        dim ? "bg-neutral-50 opacity-60 dark:bg-neutral-950" : "bg-[#fffdf0] dark:bg-[#1a1a0e]"
      } ${ok ? "cursor-pointer" : "opacity-40"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!ok}
        onChange={() => onToggle(r.investor_id)}
        className="shrink-0 scale-125 accent-[#5c6e2d]"
        aria-label={`Select ${r.name}`}
      />
      <span className="shrink-0 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{r.name}</span>
      {r.email_bounced && (
        <span className="shrink-0 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          Email bounced
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
        {r.company ?? ""}
      </span>
      <span className="shrink-0 text-xs text-neutral-400">
        {r.phone ? "📱 " : ""}{r.email && !r.email_bounced ? "✉️" : ""}{!ok ? "no contact info" : ""}
      </span>
      {r.already_sent_at && (
        <span className="shrink-0 text-xs font-semibold text-[#5c6e2d] dark:text-[#c5cca8]">
          Sent {new Date(r.already_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - what. Verbatim from the queue row; the signature rendered, not
// described, because "attaches automatically" is not a preview.
// ---------------------------------------------------------------------------

function Preview({ row, people, signatureText, onBack, onNext }: {
  row: DispoQueueRow; people: number; signatureText: string | null;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Exactly what {people} investor{people === 1 ? "" : "s"} will receive:
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 rounded-md border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-neutral-400">
            Text (via Quo, Aldo&apos;s line)
          </p>
          <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{row.sms_body}</p>
        </div>
        <div className="flex-1 rounded-md border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
          <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-neutral-400">
            Email (from {ALDO_FROM})
          </p>
          <p className="mb-2 text-sm font-semibold">{row.email_subject}</p>
          <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{row.email_body}</p>
          {signatureText && (
            <pre className="mt-3 whitespace-pre-wrap border-t border-dashed border-neutral-200 pt-2 font-sans text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              {signatureText}
            </pre>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
        <button onClick={onBack} className="text-sm text-neutral-400 hover:text-neutral-700">← Back</button>
        <button
          onClick={onNext}
          className="rounded-md bg-[#5c6e2d] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#4d5c26]"
        >
          Next: confirm →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - confirm. Press and hold for HOLD_MS with a visible fill. Pointer
// up, pointer leave, or pointer cancel before the fill completes resets it.
// Enter and Space are deliberately NOT a path to sending - a keyboard can
// hold too, but a single keypress cannot, which is the whole point.
// ---------------------------------------------------------------------------

function Confirm({ label, people, sending, error, onBack, onFire }: {
  label: string; people: number; sending: boolean; error: string | null;
  onBack: () => void; onFire: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef(0);
  const raf = useRef<number | null>(null);
  const fired = useRef(false);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    startedAt.current = 0;
    if (!fired.current) setProgress(0);
  }, []);

  const start = (e: React.PointerEvent) => {
    if (sending || fired.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startedAt.current = performance.now();
    // The frame loop lives inside the handler: it is only ever created on a
    // pointer-down, never during render, and a function declaration can
    // schedule itself for the next frame without a TDZ complaint.
    function tick() {
      const p = holdProgress(startedAt.current, performance.now());
      setProgress(p);
      if (p >= 1) {
        if (!fired.current) { fired.current = true; onFire(); }
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);

  return (
    <div className="space-y-4">
      <p className="text-base font-semibold">{label}</p>
      <p className="text-sm text-neutral-500">
        To {people} investor{people === 1 ? "" : "s"}. Press and hold the button for 3 seconds. Let go early and nothing is sent.
      </p>
      {error && (
        <p className="rounded-md border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
        <button onClick={onBack} disabled={sending} className="text-sm text-neutral-400 hover:text-neutral-700">← Back</button>
        <button
          type="button"
          disabled={sending}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Press and hold to send"
          className="relative select-none overflow-hidden rounded-md bg-neutral-300 px-5 py-2 text-sm font-semibold text-white dark:bg-neutral-700"
          style={{ touchAction: "none" }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-[#5c6e2d]"
            style={{ width: `${progress * 100}%`, transition: progress === 0 ? "width .15s ease" : "none" }}
          />
          <span className="relative">
            {sending ? "Sending…" : progress >= 1 ? "Sending…" : "Hold to send"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Done({ result, onDone }: {
  result: { sent: number; failedCount: number; partial: Array<{ name: string; missed: string }>; warnings: string[] };
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Sent to <span className="font-semibold">{result.sent}</span> investor{result.sent === 1 ? "" : "s"}
        {result.failedCount > 0 && <span className="text-red-600"> · {result.failedCount} failed (see investor records)</span>}
        . Their records are updated and they are on Aldo&apos;s board.
      </p>
      {result.partial.length > 0 && (
        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30">
          One channel did not go through for: {result.partial.map((x) => `${x.name} (${x.missed} failed)`).join(", ")}. The other channel was delivered.
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30">
          {result.warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}
      <button onClick={onDone} className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-1.5 text-sm hover:bg-[#dce3cb]">
        Done
      </button>
    </div>
  );
}
