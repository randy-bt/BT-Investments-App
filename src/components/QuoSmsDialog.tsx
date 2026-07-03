"use client";

import { useState } from "react";
import { sendEntitySms } from "@/actions/messaging";
import type { Update } from "@/lib/types";

// Compose-and-send popup for Quo SMS. Sends the text through the Quo API,
// then logs it as a feed update (from/to numbers, time, and the message).
export function QuoSmsDialog({
  recipientName,
  phones = [],
  entityType,
  entityId,
  onSent,
  onClose,
}: {
  recipientName: string;
  phones?: string[];
  entityType: "lead" | "investor";
  entityId: string;
  onSent?: (update: Update) => void;
  onClose: () => void;
}) {
  const phoneOptions = Array.from(
    new Set(phones.map((p) => p.trim()).filter((p) => p.length > 0))
  );
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  // "Enter number…" in the dropdown flips to a free-text input.
  const [phoneCustom, setPhoneCustom] = useState(phoneOptions.length === 0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (message.trim().length === 0 || phone.trim().length === 0 || sending) return;
    setSending(true);
    setError(null);
    const res = await sendEntitySms({
      entity_type: entityType,
      entity_id: entityId,
      to: phone,
      message,
    });
    setSending(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onSent?.(res.data);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#e9f95a] px-4 py-3 text-black">
          <div>
            <div className="text-sm font-semibold">💬 Send SMS via Quo</div>
            <div className="mt-0.5 text-xs opacity-90">
              To: {recipientName}
              {phone ? ` · ${phone}` : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            To (phone)
            {!phoneCustom ? (
              <select
                value={phone}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setPhone("");
                    setPhoneCustom(true);
                  } else {
                    setPhone(e.target.value);
                  }
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100"
              >
                {phoneOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__custom__">Enter number…</option>
              </select>
            ) : (
              <>
                <input
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(206) 555-0100"
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {phoneOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhone(phoneOptions[0]);
                      setPhoneCustom(false);
                    }}
                    className="self-start text-[0.65rem] font-normal text-neutral-400 dark:text-neutral-500 hover:underline"
                  >
                    ← back to saved numbers
                  </button>
                )}
              </>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Type your text message…"
              rows={4}
              className="resize-y rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </label>

          {error && (
            <p className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Sends the text via Quo, then records it in Notes under your name — from/to numbers, time, and the message.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-4 py-2.5">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={message.trim().length === 0 || phone.trim().length === 0 || sending}
            className="rounded-md bg-[#e9f95a] border border-[#c8d83e] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#d9e94a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}
