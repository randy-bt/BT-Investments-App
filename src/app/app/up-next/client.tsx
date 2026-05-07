"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  generateLeadBrief,
  postUpNextNote,
  upNextTriggerFollowUp,
  upNextCloseLead,
  type UpNextItem,
} from "@/actions/up-next";

const MILESTONES: Array<{ key: keyof UpNextItem; label: string }> = [
  { key: "verbally_mutual", label: "VM" },
  { key: "psa_signed", label: "PSA" },
  { key: "assignment_signed", label: "Assn" },
  { key: "in_escrow", label: "Escrow" },
  { key: "emd_deposited", label: "EMD" },
  { key: "closed", label: "Closed" },
];

export function UpNextClient({ initialQueue }: { initialQueue: UpNextItem[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<UpNextItem[]>(initialQueue);
  const [cursor, setCursor] = useState(0);
  const [briefByLead, setBriefByLead] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const item of initialQueue) {
      if (item.brief && !item.briefStale) seed[item.leadId] = item.brief;
    }
    return seed;
  });
  const [briefLoadingFor, setBriefLoadingFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = queue[cursor];
  const remaining = queue.length - cursor;
  const briefFetchedRef = useRef<Set<string>>(new Set());

  // Fetch a fresh brief on card open if needed (auto-run + caching).
  useEffect(() => {
    if (!current) return;
    if (briefFetchedRef.current.has(current.leadId)) return;
    if (briefByLead[current.leadId]) {
      briefFetchedRef.current.add(current.leadId);
      return;
    }
    briefFetchedRef.current.add(current.leadId);
    setBriefLoadingFor(current.leadId);
    generateLeadBrief(current.leadId)
      .then((r) => {
        if (r.success) {
          setBriefByLead((prev) => ({ ...prev, [current.leadId]: r.data.briefText }));
        } else {
          setError(r.error);
        }
      })
      .finally(() => {
        setBriefLoadingFor(null);
      });
  }, [current, briefByLead]);

  // Reset note input on card change.
  useEffect(() => {
    setNoteText("");
    setError(null);
  }, [cursor]);

  function advance() {
    setCursor((c) => c + 1);
  }

  function skip() {
    if (queue.length <= 1) return;
    setQueue((q) => {
      const next = [...q];
      const [item] = next.splice(cursor, 1);
      next.push(item);
      return next;
    });
    // Cursor stays at the same index — what was previously skipped is now at the back.
  }

  function handlePostNote() {
    if (!current || !noteText.trim()) return;
    startTransition(async () => {
      const r = await postUpNextNote(current.leadId, noteText.trim());
      if (!r.success) {
        setError(r.error);
        return;
      }
      advance();
    });
  }

  function handleFollowUp(offset: "1week" | "1month") {
    if (!current) return;
    startTransition(async () => {
      const r = await upNextTriggerFollowUp(current.leadId, offset);
      if (!r.success) {
        setError(r.error);
        return;
      }
      advance();
    });
  }

  function handleClose() {
    if (!current) return;
    if (!confirm("Close this lead?")) return;
    startTransition(async () => {
      const r = await upNextCloseLead(current.leadId);
      if (!r.success) {
        setError(r.error);
        return;
      }
      advance();
    });
  }

  if (!current) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <h1 className="text-xl font-semibold tracking-tight mb-2">Up Next</h1>
        <p className="text-sm text-neutral-500 mb-6">
          {queue.length === 0
            ? "No leads have a green checkmark right now."
            : "All caught up. Nothing left in the queue."}
        </p>
        <Link
          href="/app"
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          Back to home
        </Link>
      </main>
    );
  }

  const briefText = briefByLead[current.leadId];
  const isBriefLoading = briefLoadingFor === current.leadId && !briefText;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 sm:px-6 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <Link href="/app" className="text-xs text-neutral-500 hover:text-neutral-800">
          ← Home
        </Link>
        <h1 className="text-base font-semibold tracking-tight">Up Next</h1>
        <span className="text-xs text-neutral-500 tabular-nums">
          {remaining} left
        </span>
      </header>

      {/* Card */}
      <article className="flex flex-col gap-4 rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm">
        {/* Name + addresses */}
        <div>
          <h2 className="text-base font-semibold tracking-tight font-editable">
            {current.leadName}
          </h2>
          {current.addresses.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm">
              {current.addresses.map((addr, i) => (
                <li key={i}>
                  <a
                    href={`https://maps.apple.com/?q=${encodeURIComponent(addr)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 font-semibold hover:underline"
                  >
                    {addr}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* AI brief */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {isBriefLoading ? (
            <span className="text-emerald-700/70 italic">Generating brief…</span>
          ) : briefText ? (
            briefText
          ) : (
            <span className="text-emerald-700/70 italic">No brief available.</span>
          )}
        </div>

        {/* Milestones */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MILESTONES.map((m) => {
            const active = !!current[m.key];
            return (
              <span
                key={m.label}
                className={`rounded-full border px-2 py-0.5 text-[0.65rem] ${
                  active
                    ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-400"
                }`}
              >
                {m.label}
              </span>
            );
          })}
        </div>

        {/* Structured fields */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Asking" value={current.asking_price} />
          <Field label="Range" value={current.range} />
          <Field
            label="Our offer"
            value={
              current.our_current_offer != null
                ? `$${current.our_current_offer.toLocaleString()}`
                : null
            }
          />
          <Field label="Condition" value={current.condition} />
          <Field label="Occupancy" value={current.occupancy_status} />
          <Field label="Timeline" value={current.selling_timeline} />
        </dl>

        {/* Recent activity */}
        {current.recentUpdates.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-neutral-700 mb-1.5">
              Recent activity
            </h3>
            <ul className="space-y-1.5">
              {current.recentUpdates.map((u, i) => (
                <li
                  key={i}
                  className="rounded border border-dashed border-neutral-200 px-2 py-1 text-sm text-neutral-700 font-editable whitespace-pre-wrap"
                >
                  <div className="text-[0.5rem] text-neutral-400 mb-0.5">
                    {u.author_name} · {new Date(u.created_at).toLocaleString()}
                  </div>
                  {u.content.length > 240 ? u.content.slice(0, 240) + "…" : u.content}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Note input */}
        <div>
          <textarea
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Type an update for this lead… posts to the activity feed and clears the checkmark."
            rows={3}
            disabled={isPending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-editable resize-none focus:outline-none focus:border-neutral-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handlePostNote}
            disabled={isPending || !noteText.trim()}
            className="mt-2 w-full rounded-md bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {isPending ? "Posting…" : "Post update"}
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleFollowUp("1week")}
            disabled={isPending}
            className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
          >
            +1 Week FU
          </button>
          <button
            type="button"
            onClick={() => handleFollowUp("1month")}
            disabled={isPending}
            className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
          >
            +1 Month FU
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Close lead
          </button>
          <button
            type="button"
            onClick={skip}
            disabled={isPending || queue.length <= 1}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => router.push(`/app/acquisitions/lead-record/${current.leadId}`)}
            className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            Open full record
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </article>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-neutral-500 text-xs">{label}</dt>
      <dd className="font-editable text-sm">{value ?? "—"}</dd>
    </div>
  );
}
