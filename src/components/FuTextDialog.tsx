"use client";

// "Send FU Text N" preview (Randy 10/9): shows the filled follow-up text
// before it goes out through Quo. Two choices: Cancel or Send. The send
// logs the usual "SMS sent via Quo" entry on the lead's feed, counts
// toward the attempt line, and opens the Mark the result pop-up after.

import { useState } from "react";
import { sendEntitySms } from "@/actions/messaging";
import { fillFuText, FU_TEXT_LABELS, type FuTextNumber } from "@/lib/fu-texts";
import type { Update } from "@/lib/types";

export function FuTextDialog({
  n,
  leadName,
  address,
  phones = [],
  entityId,
  onSent,
  onClose,
}: {
  n: FuTextNumber;
  leadName: string;
  address: string | null;
  phones?: string[];
  entityId: string;
  onSent?: (update: Update) => void;
  onClose: () => void;
}) {
  const phoneOptions = Array.from(new Set(phones.map((p) => p.trim()).filter((p) => p.length > 0)));
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = fillFuText(n, { name: leadName, address });

  async function handleSend() {
    if (sending || phone.trim().length === 0) return;
    setSending(true);
    setError(null);
    const res = await sendEntitySms({ entity_type: "lead", entity_id: entityId, to: phone, message });
    setSending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onSent?.(res.data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={FU_TEXT_LABELS[n]}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <header className="space-y-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">Follow-up text {n}</p>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Send this to {leadName}?</h2>
        </header>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">To</span>
          {phoneOptions.length > 1 ? (
            <select
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {phoneOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <span className="font-medium text-neutral-800 dark:text-neutral-100">{phone || "No phone on file"}</span>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-[#e9f95a]/40 px-4 py-3 text-sm leading-relaxed text-neutral-900 whitespace-pre-wrap dark:bg-[#e9f95a]/15 dark:text-neutral-100">
          {message}
        </div>

        {error && (
          <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending || phone.trim().length === 0}
            onClick={handleSend}
            className="rounded-xl bg-[#e9f95a] px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-[#d9e94a] active:scale-[0.99] disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
