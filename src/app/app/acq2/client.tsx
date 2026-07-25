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

export function Acq2Client() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingName, setLoadingName] = useState("");
  const [leads, setLeads] = useState<LoadedLead[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [loadedAt, setLoadedAt] = useState<string>(new Date().toISOString());
  const [openId, setOpenId] = useState<string | null>(null);
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

    const queue = await getAcq2Queue();
    if (runId !== runIdRef.current) return;
    if (!queue.success) {
      setFatal(queue.error);
      setPhase("error");
      return;
    }
    const { entries, unmatched: um, loadedAt: at } = queue.data;
    setUnmatched(um);
    setLoadedAt(at);
    setTotal(entries.length);

    const results: LoadedLead[] = entries.map((entry) => ({
      entry, lead: null, updates: [], error: null,
    }));

    // Preload full records, a few at a time, ticking the honest loader.
    let cursor = 0;
    let done = 0;
    async function worker() {
      while (cursor < entries.length) {
        const idx = cursor++;
        const entry = entries[idx];
        setLoadingName(entry.leadName);
        const [leadRes, updatesRes] = await Promise.all([
          getLead(entry.leadId),
          getUpdates("lead", entry.leadId, { page: 1, pageSize: 200 }),
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
    }, entries.length === 0 ? 0 : 420);
  }, []);

  useEffect(() => { load(); }, [load]);

  // keep the "loaded X min ago" stamp honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const open = leads.find((l) => l.entry.leadId === openId) ?? null;
  const progress = total === 0 ? 0 : loadedCount / total;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#f2f2f7] text-[#111] antialiased dark:bg-black dark:text-[#f2f2f7]"
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
              <p className="pb-5 text-[13px] text-neutral-500">
                {leads.length} flagged · loaded {relTime(loadedAt)}
              </p>

              {leads.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-[15px] text-neutral-500 dark:bg-[#1c1c1e]">
                  Nothing is flagged right now. Clean boards. 🤙
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {leads.map((l, i) => (
                  <motion.button
                    key={l.entry.leadId}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.045, 0.5), ...SPRING }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => l.lead && setOpenId(l.entry.leadId)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#1c1c1e]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-semibold leading-snug">
                        {l.entry.leadName}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-md bg-[#5c6e2d]/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5c6e2d] dark:bg-[#5c6e2d]/25 dark:text-[#c5cca8]">
                          {l.entry.board}
                        </span>
                        {l.error ? (
                          <span className="truncate text-[12px] text-red-500">couldn&apos;t load</span>
                        ) : (
                          <span className="truncate text-[12px] text-neutral-400">
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
          <LeadSheet key={open.entry.leadId} loaded={open} onBack={() => setOpenId(null)} />
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
      <div className="truncate text-[15px] font-medium">{value}</div>
    </div>
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

function LeadSheet({ loaded, onBack }: { loaded: LoadedLead; onBack: () => void }) {
  const lead = loaded.lead!;
  const feed = loaded.updates; // oldest first - the latest note is always last
  const anyMilestone = MILESTONES.some((m) => lead[m.key]);
  const address = primaryAddress(lead);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col overflow-hidden bg-[#f2f2f7] dark:bg-black"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={SPRING}
    >
      <div
        className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.06] bg-[#f2f2f7]/90 px-2 pb-2 backdrop-blur-xl dark:border-white/10 dark:bg-black/80"
        style={{ paddingTop: "max(env(safe-area-inset-top), 10px)" }}
      >
        <button onClick={onBack} className="flex items-center gap-0.5 px-2 py-1.5 text-[17px] font-medium text-[#5c6e2d] active:opacity-50 dark:text-[#c5cca8]">
          <svg width="11" height="19" viewBox="0 0 11 19" fill="none">
            <path d="M9.5 1.5l-8 8 8 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Leads
        </button>
        <div className="min-w-0 flex-1 truncate pr-2 text-center text-[16px] font-semibold">
          {loaded.entry.leadName}
        </div>
        <span className="w-[64px] shrink-0 pr-2 text-right text-[17px]">{loaded.entry.markers}</span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {/* address + map, the first thing under the name */}
          {address && (
            <section className="overflow-hidden rounded-2xl bg-white dark:bg-[#1c1c1e]">
              <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
                <h2 className="text-[21px] font-bold leading-tight tracking-tight">{address}</h2>
                <GButton address={address} className="mt-0.5" />
              </div>
              <div className="h-[230px]">
                <GoogleMap address={address} />
              </div>
            </section>
          )}

          {/* key facts */}
          <section className="rounded-2xl bg-white p-4 dark:bg-[#1c1c1e]">
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
          {(lead.phones.length > 0 || lead.emails.length > 0 || lead.mailing_address) && (
            <section className="rounded-2xl bg-white dark:bg-[#1c1c1e]">
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
              {lead.mailing_address && (
                <div className="px-4 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Mailing address</div>
                  <div className="text-[15px]">{lead.mailing_address}</div>
                </div>
              )}
            </section>
          )}

          {/* property details: size, valuations, parcel */}
          {lead.properties.map((p) => {
            const countyUrl = getCountyUrl(p.county, p.apn);
            return (
              <section key={p.id} className="rounded-2xl bg-white p-4 dark:bg-[#1c1c1e]">
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
                    : "bg-white dark:bg-[#1c1c1e]"
                }`}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate">
                    {type ? <span className="font-semibold text-cyan-600 dark:text-cyan-400">{type}</span> : <AuthorName update={u} />}
                  </span>
                  <span className="shrink-0 text-neutral-400">{fmtWhen(u.created_at)}</span>
                </div>
                <NoteBody content={u.content} />
              </section>
            );
          })}
          {feed.length === 0 && (
            <section className="rounded-2xl bg-white p-6 text-center text-[14px] text-neutral-400 dark:bg-[#1c1c1e]">
              No activity yet.
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}
