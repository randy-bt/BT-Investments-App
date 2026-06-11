"use client";

import { useState } from "react";

const FROM_ADDRESSES = ["randy@btinvestments.co", "aldo@btinvestments.co"];

// Compose-and-send popup for email. Sending isn't wired up yet — the
// Send button shows a coming-soon notice. Once connected, sending will
// also record itself in the lead/investor Notes feed.
export function SendEmailDialog({
  recipientName,
  recipientEmail,
  onClose,
}: {
  recipientName: string;
  recipientEmail?: string | null;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(FROM_ADDRESSES[0]);
  const [to, setTo] = useState(recipientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function handleSend() {
    if (to.trim().length === 0 || body.trim().length === 0) return;
    alert(
      `Email sending is coming soon. Once it's wired up, this will email ${recipientName} at ${to} from ${from} and record the message in Notes automatically.`
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#2596be] px-4 py-3 text-white">
          <div>
            <div className="text-sm font-semibold">✉️ Send Email</div>
            <div className="mt-0.5 text-xs opacity-90">To: {recipientName}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            From
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100"
            >
              {FROM_ADDRESSES.map((addr) => (
                <option key={addr} value={addr}>{addr}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            To
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Subject
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject…"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            Message
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="Type your email…"
              rows={5}
              className="resize-y rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </label>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Once connected: sends the email, then records it in Notes under your name — appended just like a regular update.
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
            disabled={to.trim().length === 0 || body.trim().length === 0}
            className="rounded-md bg-[#2596be] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1c7fa3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}
