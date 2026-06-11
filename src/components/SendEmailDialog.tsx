"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const ALL_FROM_ADDRESSES = ["randy@btinvestments.co", "aldo@btinvestments.co"];

// Compose-and-send popup for email. Sending isn't wired up yet — the
// Send button shows a coming-soon notice. Once connected, sending will
// record itself in the lead/investor Notes feed under the sender's name,
// including the from/to addresses and the message body.
// From-address rules: Randy can send from any account; everyone else
// (currently just Aldo) only from their own.
export function SendEmailDialog({
  recipientName,
  recipientEmail,
  suggestedEmails = [],
  onClose,
}: {
  recipientName: string;
  recipientEmail?: string | null;
  suggestedEmails?: string[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const fromOptions =
    user.email === "randy@btinvestments.co"
      ? ALL_FROM_ADDRESSES
      : [user.email];
  // To-field suggestions: the record's emails + any addresses spotted in
  // Notes, minus our own internal accounts.
  const toSuggestions = Array.from(
    new Set(
      [recipientEmail ?? "", ...suggestedEmails]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && !ALL_FROM_ADDRESSES.includes(e))
    )
  );

  const [from, setFrom] = useState(fromOptions[0]);
  const [to, setTo] = useState(toSuggestions[0] ?? "");
  // "Enter email…" in the To dropdown flips to a free-text input.
  const [toCustom, setToCustom] = useState(toSuggestions.length === 0);
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
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-500 bg-neutral-100 dark:bg-neutral-600 px-4 py-3 text-neutral-900 dark:text-white">
          <div>
            <div className="text-sm font-semibold">✉️ Send Email</div>
            <div className="mt-0.5 text-xs opacity-80">To: {recipientName}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-70 hover:opacity-100">×</button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            From
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={fromOptions.length === 1}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 disabled:opacity-70"
            >
              {fromOptions.map((addr) => (
                <option key={addr} value={addr}>{addr}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            To
            {!toCustom ? (
              <select
                value={to}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setTo("");
                    setToCustom(true);
                  } else {
                    setTo(e.target.value);
                  }
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100"
              >
                {toSuggestions.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
                <option value="__custom__">Enter email…</option>
              </select>
            ) : (
              <>
                <input
                  type="email"
                  autoFocus
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@example.com"
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-normal text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                />
                {toSuggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTo(toSuggestions[0]);
                      setToCustom(false);
                    }}
                    className="self-start text-[0.65rem] font-normal text-neutral-400 dark:text-neutral-500 hover:underline"
                  >
                    ← back to suggested emails
                  </button>
                )}
              </>
            )}
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
            Once connected: sends the email, then records it in Notes under your name — including who it was sent from and to, plus the message.
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
            className="rounded-md bg-neutral-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-600 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}
