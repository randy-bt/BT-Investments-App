"use client";

// The Deals tab (dispositions rebuild, Geoffrey brief Oct 2 2026).
//
// Two framed blocks in one dashed card: "Queued for Marketing" as collapsed
// rows, "Active Marketing" as square tiles. The split is do-sends-exist,
// computed server-side in getDispoDeals so one definition serves this tab,
// the board text and the homepage counter.
//
// STAGE 2 is read-only on purpose: Send (N) opens the EXISTING send wizard,
// unchanged, because rewiring the one path in the app that spends money is
// its own reviewed change. The no-page rule is shown here AND enforced in
// sendQueueRow, so the disabled button is a courtesy rather than the guard.

import { useState } from "react";
import type { DispoDeal, DispoFacts } from "@/actions/dispo-deals";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Two lines, exactly: price · bd · ba · sq ft, then the lot. Land collapses
 *  the first line to "price · Land", which is how Randy reads a lot deal. */
function Facts({ facts }: { facts: DispoFacts }) {
  const n = (v: number | null) => (v === null ? null : v.toLocaleString());
  const parts: string[] = [];
  if (facts.isLand) {
    parts.push("Land");
  } else {
    if (facts.beds !== null) parts.push(`${facts.beds} bd`);
    if (facts.baths !== null) parts.push(`${facts.baths} ba`);
    if (facts.sqft !== null) parts.push(`${n(facts.sqft)} sq ft`);
  }
  return (
    <div className="text-xs text-neutral-600 dark:text-neutral-300">
      <div>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
          {facts.price ?? "—"}
        </span>
        {parts.length > 0 && <span> · {parts.join(" · ")}</span>}
      </div>
      {facts.lotSize && <div className="text-neutral-500 dark:text-neutral-400">{facts.lotSize} lot</div>}
    </div>
  );
}

function SourcePill({ kind }: { kind: DispoDeal["kind"] }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#c5cca8] bg-[#e8edda] px-2 py-0.5 text-[10px] font-medium text-[#42501f] dark:border-[#42501f] dark:bg-[#2a2f1c] dark:text-[#b7c48a]">
      Source: {kind === "acq" ? "Acquisitions" : "JV deal"}
    </span>
  );
}

const BTN =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800";

function DealButtons({ deal }: { deal: DispoDeal }) {
  if (deal.kind === "jv") {
    return (
      <a className={BTN} href={`/api/jv/email/${deal.id}`} target="_blank" rel="noopener noreferrer">
        JV deal
      </a>
    );
  }
  return (
    <>
      {deal.leadId && (
        <a className={BTN} href={`/app/acquisitions/lead-record/${deal.leadId}`}>Lead page</a>
      )}
      {deal.pageUrl && (
        <a className={BTN} href={deal.pageUrl} target="_blank" rel="noopener noreferrer">
          Marketing page
        </a>
      )}
    </>
  );
}

function CountChip({ n, tone }: { n: number; tone: "amber" | "olive" }) {
  return (
    <span
      className={`ml-2 inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === "amber"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-[#e8edda] text-[#42501f] dark:bg-[#2a2f1c] dark:text-[#b7c48a]"
      }`}
    >
      {n}
    </span>
  );
}

function QueuedRow({ deal, onSend }: { deal: DispoDeal; onSend: (d: DispoDeal) => void }) {
  const [open, setOpen] = useState(false);
  const sendable = deal.hasPage && deal.queueId !== null;
  return (
    <div className="border-b border-dashed border-neutral-200 last:border-0 dark:border-neutral-700">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className={`text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{deal.displayName}</span>
            {deal.subName && (
              <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {deal.subName}
              </span>
            )}
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {deal.address}
            </span>
          </span>
          <span className="hidden shrink-0 text-xs text-neutral-400 sm:block">
            Added {fmtDate(deal.addedAt)}
          </span>
        </button>
        <button
          type="button"
          disabled={!sendable}
          onClick={() => onSend(deal)}
          title={sendable ? undefined : "Needs a marketing page before it can be sent."}
          className="shrink-0 rounded-md bg-[#5c6e2d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4d5c26] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send{deal.matchCount !== null ? ` (${deal.matchCount})` : ""}
        </button>
      </div>
      {open && (
        <div className="space-y-2 px-3 pb-3 pl-9">
          <Facts facts={deal.facts} />
          {!deal.hasPage && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Needs a marketing page before it can be sent.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <SourcePill kind={deal.kind} />
            <DealButtons deal={deal} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveTile({ deal }: { deal: DispoDeal }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div>
        <div className="text-sm font-semibold">{deal.displayName}</div>
        {deal.subName && (
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{deal.subName}</div>
        )}
        <div className="text-xs text-neutral-500 dark:text-neutral-400">{deal.address}</div>
      </div>
      <Facts facts={deal.facts} />
      <div className="mt-auto space-y-1.5 border-t border-dashed border-neutral-200 pt-2 dark:border-neutral-700">
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Sent to {deal.sentCount} investor{deal.sentCount === 1 ? "" : "s"} · {fmtDate(deal.lastSentAt)}
        </div>
        <div><SourcePill kind={deal.kind} /></div>
        <div className="flex flex-wrap gap-2 pt-0.5"><DealButtons deal={deal} /></div>
      </div>
    </div>
  );
}

export function DealsTab({
  queued,
  active,
  onSend,
}: {
  queued: DispoDeal[];
  active: DispoDeal[];
  onSend: (d: DispoDeal) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <section className="rounded-lg border border-neutral-200 border-t-2 border-t-amber-400 dark:border-neutral-700">
        <h2 className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
          Queued for Marketing
          <CountChip n={queued.length} tone="amber" />
        </h2>
        {queued.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-neutral-400">Nothing queued.</p>
        ) : (
          <div>{queued.map((d) => <QueuedRow key={`${d.kind}-${d.id}`} deal={d} onSend={onSend} />)}</div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 border-t-2 border-t-[#5c6e2d] dark:border-neutral-700">
        <h2 className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
          Active Marketing
          <CountChip n={active.length} tone="olive" />
        </h2>
        {active.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-neutral-400">Nothing being marketed yet.</p>
        ) : (
          // 3 per row, 2 under 860px, 1 under 560px; a short last row centres
          // rather than hugging the left edge (brief §2).
          <div className="flex flex-wrap justify-center gap-3 p-3">
            {active.map((d) => (
              <div
                key={`${d.kind}-${d.id}`}
                className="w-full min-[560px]:w-[calc(50%-0.375rem)] min-[860px]:w-[calc(33.333%-0.5rem)]"
              >
                <ActiveTile deal={d} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
