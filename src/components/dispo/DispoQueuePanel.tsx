"use client";

// Randy's chunk of the DSP Dashboard (agent-requests #14.2): the
// ready-to-send queue. Rows read like board lines - 🏠📤 name - N Matches -
// but they are LIVE DATA from dispo_queue, not board text, because the
// send cascade clears rows automatically and auto-edited rich text is how
// boards rot. Aldo's chunk below stays a real editable board.
//
// Two gutter buttons per row (14.2):
//   left  = preview: the exact text + email queued, verbatim from the row
//   right = send wizard: checkbox recipients -> side-by-side previews -> SEND
//
// While the system is build-only, SEND is also refused server-side by the
// dispo_sends_enabled kill switch; the wizard surfaces that refusal
// honestly instead of pretending.

import { useCallback, useEffect, useState } from "react";
import {
  getDispoQueue,
  getQueueRecipients,
  sendQueueRow,
  type DispoQueueRow,
  type QueueRecipient,
} from "@/actions/dispo";

export function DispoQueuePanel({ initialRows }: { initialRows: DispoQueueRow[] }) {
  const [rows, setRows] = useState<DispoQueueRow[]>(initialRows);
  const [previewRow, setPreviewRow] = useState<DispoQueueRow | null>(null);
  const [wizardRow, setWizardRow] = useState<DispoQueueRow | null>(null);

  const refresh = useCallback(async () => {
    const r = await getDispoQueue();
    if (r.success) setRows(r.data);
  }, []);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        Nothing ready to send. Rows appear here when a marketing page is created or a JV deal is
        marked Interested.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <div
          key={row.id}
          className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
        >
          {/* left gutter: preview */}
          <button
            onClick={() => setPreviewRow(row)}
            aria-label={`Preview messages for ${row.deal_name}`}
            title="Preview the queued text + email"
            className="shrink-0 rounded border border-dashed border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-700 group-hover:opacity-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
          >
            👁
          </button>

          <span className="min-w-0 flex-1 truncate font-editable text-[15px]">
            🏠📤 {row.deal_name} - {row.match_count} Match{row.match_count === 1 ? "" : "es"}
          </span>

          {/* right gutter: send wizard */}
          <button
            onClick={() => setWizardRow(row)}
            aria-label={`Send ${row.deal_name}`}
            title="Open the send wizard"
            className="shrink-0 rounded border border-dashed border-[#c5cca8] bg-[#e8edda] px-2 py-0.5 text-xs text-neutral-700 opacity-0 transition-opacity hover:bg-[#dce3cb] group-hover:opacity-100 dark:bg-[#3a4030] dark:text-neutral-200"
          >
            Send →
          </button>
        </div>
      ))}

      {previewRow && <PreviewDialog row={previewRow} onClose={() => setPreviewRow(null)} />}
      {wizardRow && (
        <SendWizard
          row={wizardRow}
          onClose={() => setWizardRow(null)}
          onSent={() => {
            setWizardRow(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-lg dark:border-neutral-600 dark:bg-neutral-900">
        {children}
      </div>
    </div>
  );
}

function MessageCard({ kind, subject, body }: { kind: "text" | "email"; subject?: string; body: string }) {
  return (
    <div className="flex-1 rounded-md border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
      <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-wider text-neutral-400">
        {kind === "text" ? "Text (via Quo, Aldo's line)" : "Email (from aldo@btinvestments.co)"}
      </p>
      {subject && <p className="mb-2 text-sm font-semibold">{subject}</p>}
      <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{body}</p>
      {kind === "email" && (
        <p className="mt-3 border-t border-dashed border-neutral-200 pt-2 text-xs italic text-neutral-400 dark:border-neutral-700">
          Aldo&apos;s signature attaches automatically.
        </p>
      )}
    </div>
  );
}

function PreviewDialog({ row, onClose }: { row: DispoQueueRow; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Queued messages · {row.deal_name}</h3>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700">✕</button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <MessageCard kind="text" body={row.sms_body} />
        <MessageCard kind="email" subject={row.email_subject} body={row.email_body} />
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------

function SendWizard({
  row,
  onClose,
  onSent,
}: {
  row: DispoQueueRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [recipients, setRecipients] = useState<QueueRecipient[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failedCount: number } | null>(null);

  useEffect(() => {
    getQueueRecipients(row.id).then((r) => {
      if (!r.success) {
        setError(r.error);
        return;
      }
      setRecipients(r.data);
      // All checked by default (14.2), except bounced emails with no phone,
      // which cannot receive anything.
      setChecked(new Set(r.data.filter((x) => x.phone || (x.email && !x.email_bounced)).map((x) => x.investor_id)));
    });
  }, [row.id]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function fireSend() {
    setSending(true);
    setError(null);
    const r = await sendQueueRow(row.id, Array.from(checked));
    setSending(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    setResult({ sent: r.data.sent, failedCount: r.data.failed.length });
  }

  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Send · {row.deal_name}
          <span className="ml-3 text-xs font-normal text-neutral-400">step {step} of 2</span>
        </h3>
        <button onClick={onClose} className="text-sm text-neutral-400 hover:text-neutral-700">✕</button>
      </div>

      {result ? (
        <div className="space-y-4">
          <p className="text-sm">
            Sent to <span className="font-semibold">{result.sent}</span> investor{result.sent === 1 ? "" : "s"}
            {result.failedCount > 0 && (
              <span className="text-red-600"> · {result.failedCount} failed (see investor records)</span>
            )}
            . Their records are updated and they are on Aldo&apos;s board.
          </p>
          <button
            onClick={onSent}
            className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-1.5 text-sm hover:bg-[#dce3cb]"
          >
            Done
          </button>
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Everyone below gets the text and the email. Uncheck anyone to leave out.
          </p>
          {!recipients && !error && <p className="text-sm text-neutral-400">Loading investors…</p>}
          {recipients && recipients.length === 0 && (
            <p className="text-sm text-neutral-400">No matched investors for this deal.</p>
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {recipients?.map((r) => {
              const unreachable = !r.phone && (!r.email || r.email_bounced);
              return (
                <label
                  key={r.investor_id}
                  className={`flex items-center gap-3 rounded px-2 py-1 text-sm ${unreachable ? "opacity-40" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(r.investor_id)}
                    disabled={unreachable}
                    onChange={() => toggle(r.investor_id)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {r.name}
                    {r.company && <span className="text-neutral-400"> · {r.company}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {r.phone ? "📱" : ""}
                    {r.email && !r.email_bounced ? " ✉️" : ""}
                    {r.email_bounced ? " ⛔ email bounced" : ""}
                    {unreachable ? "no contact info" : ""}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
            <span className="text-xs text-neutral-400">{checked.size} selected</span>
            <button
              onClick={() => setStep(2)}
              disabled={checked.size === 0}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-4 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-40"
            >
              Proceed →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Exactly what {checked.size} investor{checked.size === 1 ? " " : "s "}
            will receive:
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <MessageCard kind="text" body={row.sms_body} />
            <MessageCard kind="email" subject={row.email_subject} body={row.email_body} />
          </div>
          {error && (
            <p className="rounded-md border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-700">
            <button onClick={() => setStep(1)} className="text-sm text-neutral-400 hover:text-neutral-700">
              ← Back
            </button>
            <button
              onClick={fireSend}
              disabled={sending}
              className="rounded-md border border-[#8a9a5b] bg-[#5c6e2d] px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#4d5c26] disabled:opacity-50"
            >
              {sending ? "Sending…" : `SEND to ${checked.size}`}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}
