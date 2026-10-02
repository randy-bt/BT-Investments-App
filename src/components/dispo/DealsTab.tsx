"use client";

// The Deals tab, translated value-for-value from the approved mockup
// (dispositions rebuild, Randy Oct 2026). The styling lives in globals.css
// under .dsp-* with the mockup's own variables, rather than mapped onto
// Tailwind's scale - mapping it is what made the first pass render at about
// 75% of the intended type sizes.
//
// Still read-only: Send (N) opens the EXISTING wizard. Rewiring the one path
// that spends money is stage 3.

import { useState } from "react";
import type { DispoDeal, DispoFacts } from "@/actions/dispo-deals";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Two lines: price · bd · ba · sq ft, then the lot. Land collapses the first
 *  line to "price · Land", which is how Randy reads a lot deal. */
function Facts({ facts }: { facts: DispoFacts }) {
  const parts: string[] = [];
  if (facts.isLand) parts.push("Land");
  else {
    if (facts.beds !== null) parts.push(`${facts.beds} bd`);
    if (facts.baths !== null) parts.push(`${facts.baths} ba`);
    if (facts.sqft !== null) parts.push(`${facts.sqft.toLocaleString()} sq ft`);
  }
  return (
    <div className="dsp-facts">
      <span>
        <b>{facts.price ?? "—"}</b>
        {parts.length > 0 && ` · ${parts.join(" · ")}`}
      </span>
      {facts.lotSize && <span>{facts.lotSize} lot</span>}
    </div>
  );
}

const SrcPill = ({ kind }: { kind: DispoDeal["kind"] }) => (
  <span className={`dsp-src ${kind}`}>Source: {kind === "acq" ? "Acquisitions" : "JV deal"}</span>
);

function DealButtons({ deal }: { deal: DispoDeal }) {
  if (deal.kind === "jv") {
    return (
      <a className="dsp-b" href={`/api/jv/email/${deal.id}`} target="_blank" rel="noopener noreferrer">
        JV deal
      </a>
    );
  }
  return (
    <>
      {deal.leadId && <a className="dsp-b" href={`/app/acquisitions/lead-record/${deal.leadId}`}>Lead page</a>}
      {deal.pageUrl && (
        <a className="dsp-b" href={deal.pageUrl} target="_blank" rel="noopener noreferrer">Marketing page</a>
      )}
    </>
  );
}

function QueuedRow({ deal, onSend }: { deal: DispoDeal; onSend: (d: DispoDeal) => void }) {
  const [open, setOpen] = useState(false);
  // The standing rule, shown: no marketing page, no Send. Enforced again in
  // sendQueueRow, so this is the courtesy and not the guard.
  const sendable = deal.hasPage;
  return (
    <div className={`dsp-qrow${open ? " open" : ""}`}>
      <div className="dsp-qline">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="dsp-qsum"
        >
          <span className="dsp-chev">›</span>
          <span className="dsp-nm">
            {deal.displayName}
            {deal.subName && <small>{deal.subName}</small>}
          </span>
          <span className="dsp-qa">{deal.address}</span>
          <span className="dsp-added">Added {fmtDate(deal.addedAt)}</span>
        </button>
        <button
          type="button"
          className="dsp-send"
          disabled={!sendable}
          onClick={() => onSend(deal)}
          title={sendable ? undefined : "Needs a marketing page before it can be sent."}
        >
          Send{deal.matchCount !== null ? ` (${deal.matchCount})` : ""}
        </button>
      </div>
      {open && (
        <div className="dsp-exp">
          <Facts facts={deal.facts} />
          {!deal.hasPage && <p className="dsp-why">Needs a marketing page before it can be sent.</p>}
          <div className="dsp-exp-foot">
            <SrcPill kind={deal.kind} />
            <span className="dsp-right"><DealButtons deal={deal} /></span>
          </div>
        </div>
      )}
    </div>
  );
}

const ActiveTile = ({ deal }: { deal: DispoDeal }) => (
  <div className="dsp-tile">
    <div className="dsp-tb">
      <div className="dsp-who">
        {deal.displayName}
        {deal.subName && <small>{deal.subName}</small>}
      </div>
      <div className="dsp-addr">{deal.address}</div>
      <Facts facts={deal.facts} />
    </div>
    <div className="dsp-meta">
      <span>
        Sent to {deal.sentCount} investor{deal.sentCount === 1 ? "" : "s"} · {fmtDate(deal.lastSentAt)}
      </span>
      <SrcPill kind={deal.kind} />
    </div>
    <div className="dsp-btns">
      <DealButtons deal={deal} />
    </div>
  </div>
);

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
    <div>
      <section className="dsp-sbox ready">
        <h3>
          Queued for Marketing <span className="dsp-cnt">{queued.length}</span>
        </h3>
        {queued.length === 0 ? (
          <p className="dsp-qa">Nothing queued.</p>
        ) : (
          <div className="dsp-qlist">
            {queued.map((d) => <QueuedRow key={`${d.kind}-${d.id}`} deal={d} onSend={onSend} />)}
          </div>
        )}
      </section>

      <section className="dsp-sbox sent">
        <h3>
          Active Marketing <span className="dsp-cnt">{active.length}</span>
        </h3>
        {active.length === 0 ? (
          <p className="dsp-qa">Nothing being marketed yet.</p>
        ) : (
          <div className="dsp-grid">
            {active.map((d) => <ActiveTile key={`${d.kind}-${d.id}`} deal={d} />)}
          </div>
        )}
      </section>
    </div>
  );
}
