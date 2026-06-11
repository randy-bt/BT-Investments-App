"use client";

import { useState } from "react";

// Compose-and-send popup for Quo SMS. Sending isn't wired up yet —
// the Send button shows a coming-soon notice. Once the Quo API is
// connected, sending will also append a #2596be-tinted update to the
// lead/investor Notes feed ("6.11 SMS sent via Quo" + the message).
export function QuoSmsDialog({
  recipientName,
  phone,
  onClose,
}: {
  recipientName: string;
  phone?: string | null;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");

  function handleSend() {
    if (message.trim().length === 0) return;
    alert(
      "Quo SMS sending is coming soon. Once it's wired up, this will text " +
        recipientName +
        (phone ? ` at ${phone}` : "") +
        " and record the message in Notes automatically."
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[20vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#2596be] px-4 py-3 text-white">
          <div>
            <div className="text-sm font-semibold">💬 Send SMS via Quo</div>
            <div className="mt-0.5 text-xs opacity-90">
              To: {recipientName}
              {phone ? ` · ${phone}` : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        <div className="p-4">
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="Type your text message…"
            rows={4}
            className="w-full resize-y rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Sends via Quo and records itself in Notes once connected.
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
            disabled={message.trim().length === 0}
            className="rounded-md bg-[#2596be] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1c7fa3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}
