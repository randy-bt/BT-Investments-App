"use client";

// Acquisitions 2 (Randy 7/25) — the read-only mobile companion.
//
// Experience: an honest loading gate preloads the FULL record of every
// dashboard-flagged lead (right-side ✅/❌/⚠️ on ACQ or AACQ), then the
// page behaves like a native app: big tappable rows, spring slide-over
// record view, zero network waits after the gate. View-only by
// construction - every call in this file is a read action.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAcq2Queue } from "@/actions/acq2";
import { getLead } from "@/actions/leads";
import { getUpdates } from "@/actions/updates";
import { listAttachmentsForUpdates, getDownloadUrl } from "@/actions/attachments";
import { postLeadDealSnapshot } from "@/actions/up-next";
import { FloatingIndicaButton } from "@/components/indica/FloatingIndicaButton";
import { summarizeAttachments, attachmentKind, attachmentIcon, formatFileSize } from "@/lib/attachment-display";
import type { Attachment } from "@/lib/types";
import { listOpenRoundNotes, type OpenRoundNote } from "@/actions/round-notes";
import { RoundSections, PinnedRoundNote, type RoundRow } from "./round-notes-ui";
import { GoogleMap } from "@/components/GoogleMap";
import { getCountyUrl } from "@/lib/county-links";
import { OWNER_EMAIL, AI_AGENT_EMAIL, AI_AGENT_COLOR } from "@/lib/team";
import {
  DEAL_SNAPSHOT_PREFIX,
  MARKETING_ONE_LINER_PREFIX,
  AI_REVIEW_PREFIX,
  QUO_SMS_PREFIX,
  SENT_EMAIL_PREFIX,
} from "@/lib/content-markers";
import type { Acq2QueueEntry } from "@/lib/acq2-parse";
import type { LeadWithRelations, Update } from "@/lib/types";

type FeedUpdate = Update & { author_name: string; author_role: string; author_email: string };

type LoadedLead = {
  leadId: string;
  leadName: string;
  entry: Acq2QueueEntry;
  lead: LeadWithRelations | null;
  updates: FeedUpdate[];
  error: string | null;
};

type Phase = "loading" | "ready" | "error";

const SPRING = { type: "spring", stiffness: 320, damping: 32 } as const;

// ---------------------------------------------------------------- utils

function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const SNAPSHOT_PREFIXES: Array<[string, string]> = [
  [DEAL_SNAPSHOT_PREFIX, "Deal Snapshot"],
  [MARKETING_ONE_LINER_PREFIX, "Marketing One-Liner"],
  [AI_REVIEW_PREFIX, "AI Review"],
  ["— AI Summary —", "AI Summary"],
  [QUO_SMS_PREFIX, "Quo SMS"],
  [SENT_EMAIL_PREFIX, "Email"],
];

// Same placeholder the main feed keys off. The real metadata lives in the
// attachments table; this line only marks that there is some.
const FILE_NOTE_RE = /^\[\d+ files? attached\]$/;
function isFileNote(content: string): boolean {
  return FILE_NOTE_RE.test(content.trim());
}

/**
 * A file note, rendered as what it actually is.
 *
 * Randy, 8/13: "[1 file attached]" told him nothing on his phone, and ~90% of
 * these are call recordings. Tapping hands the file to iOS rather than
 * embedding a player - his call, and it keeps ACQ2 read-only: a signed
 * download URL reads, it does not write.
 */
function FileNote({ files }: { files: Attachment[] | undefined }) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!files) {
    return <div className="text-[14px] text-neutral-400">Loading attachment…</div>;
  }
  const summary = summarizeAttachments(files);
  if (!summary) {
    // The note says files are attached but none came back - say so rather
    // than rendering an empty box.
    return <div className="text-[14px] text-neutral-400">Attachment unavailable</div>;
  }

  async function open(id: string) {
    setBusy(id);
    const r = await getDownloadUrl(id);
    setBusy(null);
    if (!r.success) {
      alert(`Couldn't open that file: ${r.error}`);
      return;
    }
    window.open(r.data, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[15px] font-medium">
        <span className="text-[17px] leading-none">{summary.icon}</span>
        <span>{summary.label}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {files.map((f) => {
          const size = formatFileSize(f.file_size);
          return (
            <button
              key={f.id}
              onClick={() => open(f.id)}
              disabled={busy === f.id}
              className="flex items-center gap-2 rounded-xl bg-black/[0.035] px-3 py-2.5 text-left active:scale-[0.99] disabled:opacity-50 dark:bg-white/[0.06]"
            >
              <span className="shrink-0 text-[15px] leading-none">
                {attachmentIcon(attachmentKind(f.file_type, f.file_name))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{f.file_name}</span>
                {size && <span className="block text-[11px] text-neutral-400">{size}</span>}
              </span>
              <span className="shrink-0 text-[13px] text-neutral-400">
                {busy === f.id ? "…" : "›"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function specialType(content: string): string | null {
  for (const [prefix, label] of SNAPSHOT_PREFIXES) {
    if (content.startsWith(prefix)) return label;
  }
  return null;
}

// Mirrors the feed's date-stamp + per-line-bullet rendering (raw mode via
// the leading U+200B marker skips bullets, exactly like the app).
function NoteBody({ content }: { content: string }) {
  const raw = content.startsWith("​");
  const stripped = raw ? content.slice(1) : content;
  const dateMatch = stripped.match(/^(\d{1,2}\.\d{1,2})\s/);
  const stamp = dateMatch?.[1] ?? null;
  const body = stamp ? stripped.slice(stamp.length).trim() : stripped;
  const lines = body.split("\n").filter((l) => l.trim());

  return (
    <div className="flex gap-2 text-[15px] leading-relaxed">
      {stamp && <span className="shrink-0 font-bold">{stamp}</span>}
      <div className="min-w-0 flex-1">
        {raw || lines.length <= 1 ? (
          <p className="whitespace-pre-wrap">{body}</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="shrink-0 select-none opacity-40">•</span>
              <span className="min-w-0 flex-1">{line.trim()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function primaryAddress(lead: LeadWithRelations | null): string | null {
  if (!lead) return null;
  return lead.properties.find((p) => p.address)?.address || lead.mailing_address || null;
}

function fmtDollars(v: number | null): string | null {
  return v ? `$${v.toLocaleString()}` : null;
}

function AuthorName({ update }: { update: FeedUpdate }) {
  if (update.author_email === OWNER_EMAIL) {
    return <span className="font-semibold text-[#8a6c00] dark:text-[#d4af37]">Acquisitions Manager</span>;
  }
  if (update.author_email === AI_AGENT_EMAIL) {
    return <span className="font-semibold" style={{ color: AI_AGENT_COLOR }}>{update.author_name}</span>;
  }
  return <span className="font-semibold">{update.author_name}</span>;
}

// -------------------------------------------------------------- client

export function Acq2Client({ currentUserName }: { currentUserName: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingName, setLoadingName] = useState("");
  const [leads, setLeads] = useState<LoadedLead[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<OpenRoundNote[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const runIdRef = useRef(0);

  const load = useCallback(async () => {
    const runId = ++runIdRef.current;
    setPhase("loading");
    setFatal(null);
    setLoadedCount(0);
    setTotal(0);
    setLeads([]);
    setOpenId(null);
    setExpandedId(null);

    const [queue, notesRes] = await Promise.all([getAcq2Queue(), listOpenRoundNotes()]);
    if (runId !== runIdRef.current) return;
    if (!queue.success) {
      setFatal(queue.error);
      setPhase("error");
      return;
    }
    const { entries, unmatched: um, loadedAt: at } = queue.data;
    // A failed notes read must never take the page down - ACQ2's job is the
    // boards; a round is an overlay on top of them.
    const openNotes = notesRes.success ? notesRes.data : [];
    setNotes(openNotes);
    setUnmatched(um);
    setLoadedAt(at);

    // The hard rule (Randy 8/1): no flag, no appearance. Only flagged leads
    // are preloaded or rendered; a note whose lead has lost its flag simply
    // does not show, and the next startRound wipes it.
    const results: LoadedLead[] = entries.map((entry) => ({
      leadId: entry.leadId, leadName: entry.leadName,
      entry, lead: null, updates: [], error: null,
    }));
    setTotal(results.length);

    // Preload full records, a few at a time, ticking the honest loader.
    let cursor = 0;
    let done = 0;
    async function worker() {
      while (cursor < results.length) {
        const idx = cursor++;
        const row = results[idx];
        setLoadingName(row.leadName);
        const [leadRes, updatesRes] = await Promise.all([
          getLead(row.leadId),
          getUpdates("lead", row.leadId, { page: 1, pageSize: 200 }),
        ]);
        if (runId !== runIdRef.current) return;
        if (leadRes.success) {
          results[idx].lead = leadRes.data;
          results[idx].updates = updatesRes.success ? updatesRes.data.items : [];
          if (!updatesRes.success) results[idx].error = updatesRes.error;
        } else {
          results[idx].error = leadRes.error;
        }
        done++;
        setLoadedCount(done);
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker));
    if (runId !== runIdRef.current) return;

    setLeads(results);
    // let the bar rest at full for a beat before the reveal
    setTimeout(() => {
      if (runId === runIdRef.current) setPhase("ready");
    }, results.length === 0 ? 0 : 420);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Dark mode (fix list item 5). The app's dark styles hang off a .dark
  // class driven by localStorage "bt-dark-mode" - but a home-screen web app
  // gets its OWN storage context, where that key was never set, so ACQ2
  // rendered light regardless of the phone's theme. Same source of truth,
  // plus a fallback: explicit app choice wins; unset follows the system.
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    let stored: string | null = null;
    try { stored = localStorage.getItem("bt-dark-mode"); } catch { /* private mode */ }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = stored === "true" || (stored === null && mq.matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.classList.toggle("dark", had);
    };
  }, []);

  // keep the "loaded X min ago" stamp honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const open = leads.find((l) => l.leadId === openId) ?? null;
  const progress = total === 0 ? 0 : loadedCount / total;

  // The hard rule (Randy 8/1): a flag is the only way into ACQ2. A note for
  // a lead with no current flag is invisible - no chip, no dimmed row, no
  // exception - and the next startRound wipes it. Round view exists only
  // while at least one FLAGGED lead has an open note.
  const flagged = new Set(leads.map((l) => l.leadId));
  const visibleNotes = notes.filter((n) => flagged.has(n.lead_id));
  const noteByLead = new Map(visibleNotes.map((n) => [n.lead_id, n]));
  const inRound = visibleNotes.length > 0;

  const toRow = (note: OpenRoundNote): RoundRow => {
    const l = leads.find((x) => x.leadId === note.lead_id)!;
    // newest by created_at rather than trusting feed order
    const last = l.updates.reduce<FeedUpdate | null>(
      (a, b) => (!a || b.created_at > a.created_at ? b : a),
      null,
    );
    return {
      note,
      leadName: l.leadName,
      address: primaryAddress(l.lead),
      markers: l.entry.markers,
      board: l.entry.board,
      lastUpdate: last
        ? { name: last.author_name, email: last.author_email, at: last.created_at }
        : null,
      loadFailed: Boolean(l.error),
      canOpen: Boolean(l.lead),
    };
  };
  const mechanical = visibleNotes.filter((n) => n.section === "mechanical").map(toRow);
  const decisions = visibleNotes.filter((n) => n.section === "decision").map(toRow);

  // When the round was written (fix list item 6): notes persist until
  // resolved, so without a timestamp Tuesday's read is indistinguishable
  // from Friday's. Last write = when the agent called the round ready.
  const roundAt = visibleNotes.length
    ? visibleNotes.map((n) => n.created_at).reduce((a, b) => (a > b ? a : b))
    : null;
  const roundStale = roundAt !== null && Date.now() - new Date(roundAt).getTime() > 24 * 3600e3;

  // The agent writes up every lead flagged at sweep time, so a lead here
  // means one of two things: its flag landed mid-round (the agent does not
  // mutate a round in progress, so it waits for the next one), or the sweep
  // was interrupted. Naming them lets Randy say which in one message back;
  // the app cannot tell the two apart and should not pretend to.
  //
  // Plain text on purpose - these are not part of the round, so they get no
  // tappable row. Silence here is the signal that the round is complete.
  const unnoted = inRound
    ? leads.filter((l) => !noteByLead.has(l.leadId)).map((l) => l.leadName)
    : [];

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#f2f2f7] text-[#111] antialiased dark:bg-[#1a1a1a] dark:text-[#e5e5e5]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" }}
    >
      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div
            key="loader"
            className="flex h-full flex-col items-center justify-center gap-6 px-10"
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Acquisitions
            </div>
            <div className="h-1.5 w-60 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[#5c6e2d]"
                initial={{ width: "4%" }}
                animate={{ width: `${Math.max(4, progress * 100)}%` }}
                transition={{ ease: "easeOut", duration: 0.4 }}
              />
            </div>
            <div className="flex h-10 flex-col items-center gap-1">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={loadingName || "gathering"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="text-[15px] font-medium text-neutral-500"
                >
                  {loadingName || "Reading the boards…"}
                </motion.div>
              </AnimatePresence>
              {total > 0 && (
                <div className="text-xs tabular-nums text-neutral-400">
                  {loadedCount} of {total}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="err" className="flex h-full flex-col items-center justify-center gap-4 px-10 text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-[15px] text-neutral-500">Couldn&apos;t load the boards.</p>
            <p className="text-xs text-neutral-400">{fatal}</p>
            <button onClick={load} className="rounded-full bg-[#5c6e2d] px-6 py-2.5 text-[15px] font-semibold text-white active:scale-95">
              Try again
            </button>
          </motion.div>
        )}

        {phase === "ready" && (
          <motion.div key="list" className="h-full overflow-y-auto overscroll-contain px-4 pb-16"
            style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="mx-auto max-w-lg">
              <div className="flex items-end justify-between pb-1 pt-6">
                <h1 className="text-[34px] font-bold leading-none tracking-tight">Acquisitions</h1>
                <button
                  onClick={load}
                  aria-label="Refresh"
                  className="mb-0.5 grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-neutral-500 active:scale-90 dark:bg-white/10"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                  </svg>
                </button>
              </div>
              <p className="pb-5 text-[13px] text-neutral-500 dark:text-neutral-400">
                {inRound && roundAt ? (
                  <>
                    Round written {fmtWhen(roundAt)} · {visibleNotes.length} lead{visibleNotes.length === 1 ? "" : "s"}
                    {roundStale && (
                      <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Stale
                      </span>
                    )}
                  </>
                ) : (
                  `${leads.length} flagged · loaded ${relTime(loadedAt)}`
                )}
              </p>

              {!inRound && leads.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-[15px] text-neutral-500 dark:bg-[#262626] dark:text-neutral-400">
                  Nothing is flagged right now. Clean boards. 🤙
                </div>
              )}

              {inRound ? (
                <>
                  <RoundSections
                    mechanical={mechanical}
                    decisions={decisions}
                    expandedId={expandedId}
                    onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
                    onOpenRecord={(id) => setOpenId(id)}
                  />
                  {unnoted.length > 0 && (
                    <p className="px-1 pt-6 text-[12px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                      <span className="font-semibold uppercase tracking-wider">Not in this round:</span>{" "}
                      {unnoted.join(", ")}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {leads.map((l, i) => (
                    <motion.button
                      key={l.leadId}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.045, 0.5), ...SPRING }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => l.lead && setOpenId(l.leadId)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#262626]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[17px] font-semibold leading-snug">
                          {l.leadName}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-[#5c6e2d]/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5c6e2d] dark:bg-[#5c6e2d]/25 dark:text-[#c5cca8]">
                            {l.entry.board}
                          </span>
                          {l.error ? (
                            <span className="truncate text-[12px] text-red-500">couldn&apos;t load</span>
                          ) : (
                            <span className="truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                              {primaryAddress(l.lead) || "no address on file"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-[19px] leading-none">{l.entry.markers}</span>
                      <svg className="shrink-0 text-neutral-300 dark:text-neutral-600" width="8" height="14" viewBox="0 0 8 14" fill="none">
                        <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.button>
                  ))}
                </div>
              )}

              {unmatched.length > 0 && (
                <p className="pt-5 text-center text-[12px] text-neutral-400">
                  {unmatched.length} flagged line{unmatched.length === 1 ? "" : "s"} didn&apos;t match a lead:{" "}
                  {unmatched.map((u) => `“${u.slice(0, 30)}”`).join(", ")}
                </p>
              )}
              <p className="pt-6 text-center text-[11px] text-neutral-300 dark:text-neutral-600">
                Read-only companion · the real page is untouched
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* record slide-over */}
      <AnimatePresence>
        {open && open.lead && (
          <LeadSheet
            key={open.leadId}
            loaded={open}
            note={noteByLead.get(open.leadId) ?? null}
            currentUserName={currentUserName}
            onBack={() => setOpenId(null)}
            onSnapshotPosted={async () => {
              // Refetch rather than splice: postLeadDealSnapshot returns a bare
              // Update with no author fields, and it also DELETES any previous
              // snapshot server-side. Re-reading the feed gets both facts right
              // instead of reconstructing them here.
              const r = await getUpdates("lead", open.leadId, { page: 1, pageSize: 200 });
              if (!r.success) return;
              // Same shape and order the initial preload uses.
              const fresh = r.data.items;
              setLeads((prev) =>
                prev.map((l) => (l.leadId === open.leadId ? { ...l, updates: fresh } : l)),
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------- lead sheet

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="break-words text-[15px] font-medium">{value}</div>
    </div>
  );
}

// Copies the address; the icon flips to a check for a beat as feedback.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy address"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="shrink-0 rounded-lg p-1.5 text-neutral-400 active:scale-90 active:text-neutral-600"
    >
      {copied ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c6e2d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2.5" />
          <path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5" />
        </svg>
      )}
    </button>
  );
}

const MILESTONES: Array<{ key: keyof LeadWithRelations; label: string }> = [
  { key: "verbally_mutual", label: "Verbal" },
  { key: "psa_signed", label: "PSA" },
  { key: "assignment_signed", label: "Assign" },
  { key: "in_escrow", label: "Escrow" },
  { key: "emd_deposited", label: "EMD" },
  { key: "closed", label: "Closed" },
];

// Bold G that opens a Google search for an address, same as the main page.
function GButton({ address, className = "" }: { address: string; className?: string }) {
  return (
    <a
      href={`https://www.google.com/search?q=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Search "${address}" on Google`}
      className={`shrink-0 px-1 text-[17px] font-extrabold text-neutral-400 active:text-neutral-600 ${className}`}
    >
      G
    </a>
  );
}

function LeadSheet({ loaded, note, currentUserName, onBack, onSnapshotPosted }: {
  loaded: LoadedLead;
  note: OpenRoundNote | null;
  currentUserName: string;
  onBack: () => void;
  onSnapshotPosted: () => void | Promise<void>;
}) {
  const lead = loaded.lead!;
  const feed = loaded.updates; // oldest first - the latest note is always last
  const anyMilestone = MILESTONES.some((m) => lead[m.key]);
  const address = primaryAddress(lead);

  // Attachments are fetched when the sheet opens rather than during the
  // preload: only the lead you actually open needs them, and ACQ2's whole
  // point is that the list is instant.
  const [filesByUpdate, setFilesByUpdate] = useState<Record<string, Attachment[]>>({});
  useEffect(() => {
    const ids = feed.filter((u) => isFileNote(u.content)).map((u) => u.id);
    if (ids.length === 0) return;
    let cancelled = false;
    listAttachmentsForUpdates(ids).then((r) => {
      if (!cancelled && r.success) setFilesByUpdate(r.data);
    });
    return () => { cancelled = true; };
  }, [feed]);

  const [snapshotting, setSnapshotting] = useState(false);
  const hasSnapshot = feed.some((u) => u.content.startsWith(DEAL_SNAPSHOT_PREFIX));

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden bg-[#f2f2f7] dark:bg-[#1a1a1a]"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={SPRING}
    >
      <div
        className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.06] bg-[#f2f2f7]/90 px-2 pb-2 backdrop-blur-xl dark:border-white/10 dark:bg-[#1a1a1a]/85"
        style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}
      >
        <button onClick={onBack} className="flex items-center gap-0.5 px-2 py-1.5 text-[17px] font-medium text-[#5c6e2d] active:opacity-50 dark:text-[#c5cca8]">
          <svg width="11" height="19" viewBox="0 0 11 19" fill="none">
            <path d="M9.5 1.5l-8 8 8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Leads
        </button>
        <div className="min-w-0 flex-1 truncate pr-2 text-center text-[16px] font-semibold">
          {loaded.leadName}
        </div>
        <span className="w-[64px] shrink-0 pr-2 text-right text-[17px]">{loaded.entry.markers}</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {/* the agent's round note, pinned above the record */}
          {note && <PinnedRoundNote note={note} />}

          {/* address + map, the first thing under the name */}
          {address && (
            <section className="overflow-hidden rounded-2xl bg-white dark:bg-[#262626]">
              <div className="flex items-start justify-between gap-1 px-4 pb-3 pt-4">
                <h2 className="min-w-0 flex-1 text-[21px] font-bold leading-tight tracking-tight">{address}</h2>
                <CopyButton text={address} />
                <GButton address={address} className="mt-0.5" />
              </div>
              <div className="h-[290px]">
                <GoogleMap address={address} />
              </div>
            </section>
          )}

          {/* key facts */}
          <section className="rounded-2xl bg-white p-4 dark:bg-[#262626]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Asking" value={lead.asking_price} />
              <Field label="Our offer" value={lead.our_current_offer} />
              <Field label="Range" value={lead.range} />
              <Field label="Condition" value={lead.condition} />
              <Field label="Occupancy" value={lead.occupancy_status} />
              <Field label="Timeline" value={lead.selling_timeline} />
              <Field label="Next follow-up" value={lead.next_follow_up_date} />
              <Field label="Status" value={lead.status} />
            </div>
            {anyMilestone && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3 dark:border-white/10">
                {MILESTONES.map((m) => (
                  <span
                    key={m.key}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      lead[m.key]
                        ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                        : "bg-black/[0.04] text-neutral-300 dark:bg-white/5 dark:text-neutral-600"
                    }`}
                  >
                    {m.label}
                  </span>
                ))}
                {lead.emd_date && <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-500">EMD {lead.emd_date}</span>}
                {lead.closing_date && <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-500">Close {lead.closing_date}</span>}
              </div>
            )}
          </section>

          {/* contact */}
          {(lead.phones.length > 0 || lead.emails.length > 0) && (
            <section className="rounded-2xl bg-white dark:bg-[#262626]">
              {lead.phones.map((p) => (
                <a key={p.id} href={`tel:${p.phone_number}`} className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 last:border-0 active:bg-black/[0.03] dark:border-white/10">
                  <span className="text-[15px] font-medium text-[#5c6e2d] dark:text-[#c5cca8]">{p.phone_number}</span>
                  <span className="text-[12px] text-neutral-400">{p.label || "phone"}</span>
                </a>
              ))}
              {lead.emails.map((e) => (
                <a key={e.id} href={`mailto:${e.email}`} className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 last:border-0 active:bg-black/[0.03] dark:border-white/10">
                  <span className="truncate text-[15px] font-medium text-[#5c6e2d] dark:text-[#c5cca8]">{e.email}</span>
                  <span className="shrink-0 pl-3 text-[12px] text-neutral-400">{e.label || "email"}</span>
                </a>
              ))}
            </section>
          )}

          {/* property details: size, valuations, parcel */}
          {lead.properties.map((p) => {
            const countyUrl = getCountyUrl(p.county, p.apn);
            return (
              <section key={p.id} className="rounded-2xl bg-white p-4 dark:bg-[#262626]">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Property</div>
                    {p.address !== address && <div className="text-[15px] font-semibold">{p.address}</div>}
                  </div>
                  {p.address && p.address !== address && <GButton address={p.address} />}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Sqft" value={p.sqft ? p.sqft.toLocaleString() : null} />
                  <Field label="Lot size" value={p.lot_size} />
                  <Field label="Redfin value" value={fmtDollars(p.redfin_value)} />
                  <Field label="Zillow value" value={fmtDollars(p.zillow_value)} />
                  <Field label="Beds / Baths" value={p.bedrooms || p.bathrooms ? `${p.bedrooms ?? "—"} / ${p.bathrooms ?? "—"}` : null} />
                  <Field label="Year built" value={p.year_built ? String(p.year_built) : null} />
                  {p.apn && (
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Parcel (APN)</div>
                      {countyUrl ? (
                        <a
                          href={countyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-[15px] font-medium text-cyan-600 underline-offset-2 active:underline dark:text-cyan-400"
                        >
                          {p.apn}
                        </a>
                      ) : (
                        <div className="truncate text-[15px] font-medium">{p.apn}</div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {/* activity */}
          <div className="flex items-baseline justify-between px-1 pt-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-400">Activity</h2>
            <span className="text-[11px] text-neutral-400">oldest first · {feed.length}</span>
          </div>
          {feed.map((u) => {
            const type = specialType(u.content);
            return (
              <section
                key={u.id}
                className={`rounded-2xl p-4 ${
                  u.author_email === OWNER_EMAIL && !type
                    ? "bg-[#8a6c00]/[0.07] dark:bg-[#8a6c00]/15"
                    : "bg-white dark:bg-[#262626]"
                }`}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate">
                    {type ? <span className="font-semibold text-cyan-600 dark:text-cyan-400">{type}</span> : <AuthorName update={u} />}
                  </span>
                  <span className="shrink-0 text-neutral-400">{fmtWhen(u.created_at)}</span>
                </div>
                {isFileNote(u.content)
                  ? <FileNote files={filesByUpdate[u.id]} />
                  : <NoteBody content={u.content} />}
              </section>
            );
          })}
          {feed.length === 0 && (
            <section className="rounded-2xl bg-white p-6 text-center text-[14px] text-neutral-400 dark:bg-[#262626]">
              No activity yet.
            </section>
          )}

          {/* The one write ACQ2 makes (Randy 8/13). Same call as the desktop
              button, and like it, no confirm step. */}
          <button
            onClick={async () => {
              setSnapshotting(true);
              const r = await postLeadDealSnapshot(lead.id);
              setSnapshotting(false);
              if (!r.success) {
                alert(`Snapshot failed: ${r.error}`);
                return;
              }
              await onSnapshotPosted();
            }}
            disabled={snapshotting}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500/12 py-3.5 text-[15px] font-semibold text-cyan-700 active:scale-[0.99] disabled:opacity-60 dark:bg-cyan-400/15 dark:text-cyan-300"
          >
            {snapshotting ? "Generating…" : hasSnapshot ? "Refresh Deal Snapshot" : "Deal Snapshot"}
          </button>
        </div>
      </div>

      <FloatingIndicaButton entityType="lead" entityId={lead.id} currentUserName={currentUserName} />
    </motion.div>
  );
}
