"use client";

import { Fragment, useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  generateLeadBrief,
  postUpNextNote,
  upNextTriggerFollowUp,
  upNextCloseLead,
  type UpNextItem,
} from "@/actions/up-next";
import { GoogleMap } from "@/components/GoogleMap";

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
  const [page, setPage] = useState<1 | 2>(1);
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

  // Reset note + page on card change.
  useEffect(() => {
    setNoteText("");
    setError(null);
    setPage(1);
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

  // Swipe-left across the card → close lead. Vertical swipes are
  // ignored so scrolling within the card body still works.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onCardTouchStart(e: React.TouchEvent) {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }
  function onCardTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 100 && Math.abs(dy) < 60 && dx < 0) {
      handleClose();
    }
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-2 sm:px-4 py-6">
      <header className="flex items-center justify-between mb-3 px-2">
        <Link href="/app" className="text-xs text-neutral-500 hover:text-neutral-800">
          ← Home
        </Link>
        <h1 className="text-base font-semibold tracking-tight">Up Next</h1>
        <span className="text-xs text-neutral-500 tabular-nums">
          {remaining} left
        </span>
      </header>

      {/* Three-column row: left tap zone · card · right tap zone. The
          tap zones live in the negative space alongside the card and
          show a soft chevron so they read as navigable. */}
      <div className="flex flex-1 items-stretch gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setPage(1)}
          aria-label="Previous page"
          disabled={page === 1}
          className="flex w-10 sm:w-14 flex-shrink-0 items-center justify-center text-neutral-300 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <article
          onTouchStart={onCardTouchStart}
          onTouchEnd={onCardTouchEnd}
          className="flex flex-1 flex-col gap-4 rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm min-w-0"
        >
          {page === 1 ? (
            <>
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

              {/* Map — uses the first property address. */}
              <div className="overflow-hidden rounded-md border border-dashed border-neutral-300 bg-neutral-50 h-[220px]">
                {current.addresses[0] ? (
                  <GoogleMap address={current.addresses[0]} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    No address on file
                  </div>
                )}
              </div>

              {/* Milestone timeline (horizontal). Each step is a dot
                  connected by a line; cyan when achieved, neutral when
                  not. The label sits below each dot. */}
              <MilestoneTimeline current={current} />

              {/* Field grid — left col: Asking / Condition / Occupancy.
                  Right col: Range / Our offer. */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex flex-col gap-2">
                  <Field label="Asking" value={current.asking_price} />
                  <Field label="Condition" value={current.condition} />
                  <Field label="Occupancy" value={current.occupancy_status} />
                </div>
                <div className="flex flex-col gap-2">
                  <Field label="Range" value={current.range} />
                  <Field
                    label="Our offer"
                    value={
                      current.our_current_offer != null
                        ? `$${current.our_current_offer.toLocaleString()}`
                        : null
                    }
                  />
                </div>
              </div>

              {/* AI brief — sits at the end of page 1 too so the user
                  always has the snapshot in view. */}
              <BriefBox briefText={briefText} isLoading={isBriefLoading} />
            </>
          ) : (
            <>
              {/* Page 2 leads with the AI brief, then surfaces the
                  recent activity feed in full. */}
              <BriefBox briefText={briefText} isLoading={isBriefLoading} />

              {current.recentUpdates.length > 0 ? (
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
                        {u.content.length > 240
                          ? u.content.slice(0, 240) + "…"
                          : u.content}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic">
                  No activity recorded yet.
                </p>
              )}
            </>
          )}

          {/* Shared footer: note input + actions on every page. */}
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

          <div className="flex flex-wrap items-center justify-between gap-2">
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
            </div>
            <div className="flex flex-wrap gap-2">
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
                onClick={() =>
                  router.push(`/app/acquisitions/lead-record/${current.leadId}`)
                }
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
              >
                Open full record
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Page indicator dots. */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {[1, 2].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p as 1 | 2)}
                aria-label={`Go to page ${p}`}
                className={`h-1.5 rounded-full transition-all ${
                  page === p ? "w-5 bg-neutral-700" : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>
        </article>

        <button
          type="button"
          onClick={() => setPage(2)}
          aria-label="Next page"
          disabled={page === 2}
          className="flex w-10 sm:w-14 flex-shrink-0 items-center justify-center text-neutral-300 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </main>
  );
}

function MilestoneTimeline({ current }: { current: UpNextItem }) {
  return (
    <div className="flex items-start py-1">
      {MILESTONES.map((m, i) => {
        const active = !!current[m.key];
        const isLast = i === MILESTONES.length - 1;
        return (
          <Fragment key={m.label}>
            <div className="flex flex-col items-center min-w-0">
              <div
                className={`h-3 w-3 rounded-full border-2 ${
                  active
                    ? "bg-cyan-500 border-cyan-500"
                    : "bg-white border-neutral-300"
                }`}
              />
              <div
                className={`text-[0.6rem] mt-1 ${
                  active ? "text-cyan-700 font-medium" : "text-neutral-400"
                }`}
              >
                {m.label}
              </div>
            </div>
            {!isLast && (
              <div
                className={`flex-1 h-[2px] mt-[5px] mx-1 ${
                  active ? "bg-cyan-500" : "bg-neutral-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function BriefBox({
  briefText,
  isLoading,
}: {
  briefText: string | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
      {isLoading ? (
        <span className="text-emerald-700/70 italic">Generating brief…</span>
      ) : briefText ? (
        briefText
      ) : (
        <span className="text-emerald-700/70 italic">No brief available.</span>
      )}
    </div>
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
