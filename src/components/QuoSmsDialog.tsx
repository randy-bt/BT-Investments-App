"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendEntitySms, getQuoThread } from "@/actions/messaging";
import type { Update } from "@/lib/types";
import type { QuoMessage } from "@/lib/quo";

// Quo conversation dialog: shows the full SMS thread between our Quo number
// and the selected lead number (switch numbers via the dropdown → switch
// threads), with a compose box below. Sends still log to the Notes feed.
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

  // Conversation thread state
  const [thread, setThread] = useState<QuoMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const activePhoneRef = useRef(phone);

  const loadThread = useCallback(async (num: string, silent = false) => {
    if (num.replace(/\D/g, "").length < 10) {
      setThread([]);
      return;
    }
    if (!silent) setThreadLoading(true);
    setThreadError(null);
    const res = await getQuoThread(num);
    // A slow response for a number we've already switched away from
    // shouldn't clobber the current thread.
    if (activePhoneRef.current !== num) return;
    if (!silent) setThreadLoading(false);
    if (!res.success) {
      setThreadError(res.error);
      return;
    }
    setThread(res.data);
  }, []);

  // Load on open + whenever the selected number changes (debounced for typing).
  useEffect(() => {
    activePhoneRef.current = phone;
    const t = setTimeout(() => loadThread(phone), phoneCustom ? 600 : 0);
    return () => clearTimeout(t);
  }, [phone, phoneCustom, loadThread]);

  // Light auto-refresh while the dialog is open, so replies show up.
  // Skips ticks while the tab is hidden (each tick is a Quo API call) and
  // catches up immediately when the tab becomes visible again.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) loadThread(activePhoneRef.current, true);
    }, 20000);
    const onVisible = () => {
      if (!document.hidden) loadThread(activePhoneRef.current, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadThread]);

  // Keep the newest message in view.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

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
    // Stay open like a messaging app: clear the box and refresh the thread.
    setMessage("");
    loadThread(phone, true);
  }

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-white dark:bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#e9f95a] px-4 py-3 text-black">
          <div>
            <div className="text-sm font-semibold">💬 Quo — {recipientName}</div>
            <div className="mt-0.5 text-xs opacity-90">
              {phone ? `Thread with ${phone}` : "Pick a number"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>

        {/* Number selector — switching numbers switches the thread */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2">
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
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
            >
              {phoneOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom__">Enter number…</option>
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(206) 555-0100"
                className="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
              {phoneOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPhone(phoneOptions[0]);
                    setPhoneCustom(false);
                  }}
                  className="text-[0.65rem] text-neutral-400 dark:text-neutral-500 hover:underline"
                >
                  saved numbers
                </button>
              )}
            </div>
          )}
        </div>

        {/* Conversation thread */}
        <div className="h-80 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 px-4 py-3">
          {threadLoading ? (
            <p className="py-8 text-center text-xs text-neutral-400">Loading conversation…</p>
          ) : threadError ? (
            <p className="py-8 text-center text-xs text-red-500">{threadError}</p>
          ) : thread.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-400">
              No messages yet with this number.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.direction === "outgoing" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-sm ${
                      m.direction === "outgoing"
                        ? "rounded-br-sm bg-[#e9f95a] text-black"
                        : "rounded-bl-sm bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    }`}
                  >
                    {m.text || <span className="italic opacity-60">(attachment)</span>}
                  </div>
                  <span className="mt-0.5 text-[0.6rem] text-neutral-400 dark:text-neutral-500">
                    {fmtTime(m.createdAt)}
                  </span>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>
          )}
        </div>

        {/* Compose */}
        <div className="flex flex-col gap-2 border-t border-neutral-200 dark:border-neutral-800 p-3">
          {error && (
            <p className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
              placeholder="Type your text message…"
              rows={2}
              className="flex-1 resize-y rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
            <button
              onClick={handleSend}
              disabled={message.trim().length === 0 || phone.trim().length === 0 || sending}
              className="rounded-md bg-[#e9f95a] border border-[#c8d83e] px-4 py-2 text-xs font-semibold text-black hover:bg-[#d9e94a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          <p className="text-[0.65rem] text-neutral-400 dark:text-neutral-500">
            Sends via Quo and logs to Notes. ⌘↵ to send.
          </p>
        </div>
      </div>
    </div>
  );
}
