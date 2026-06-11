"use client";

import { useState } from "react";

// Compose-and-send popup for Quo SMS. Sending isn't wired up yet —
// the Send button shows a coming-soon notice. Once the Quo API is
// connected, sending will also append a Quo-chartreuse (#e9f95a) tinted
// update to the lead/investor Notes feed ("6.11 SMS sent via Quo" + the message).
export function QuoSmsDialog({
  recipientName,
  phones = [],
  onClose,
}: {
  recipientName: string;
  phones?: string[];
  onClose: () => void;
}) {
  const phoneOptions = Array.from(
    new Set(phones.map((p) => p.trim()).filter((p) => p.length > 0))
  );
  const [phone, setPhone] = useState(phoneOptions[0] ?? "");
  // "Enter number…" in the dropdown flips to a free-text input.
  const [phoneCustom, setPhoneCustom] = useState(phoneOptions.length === 0);
  const [message, setMessage] = useState("");

  function handleSend() {
    if (message.trim().length === 0 || phone.trim().length === 0) return;
    alert(
      `Quo SMS sending is coming soon. Once it's wired up, this will text ${recipientName} at ${phone} and record the message in Notes automatically.`
    );
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

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Once connected: sends the text via Quo, then records it in Notes under your name — appended just like a regular update.
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
            disabled={message.trim().length === 0 || phone.trim().length === 0}
            className="rounded-md bg-[#e9f95a] border border-[#c8d83e] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#d9e94a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}
