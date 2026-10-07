"use client";

// The Deals tab, translated value-for-value from the approved mockup
// (dispositions rebuild, Randy Oct 2026). The styling lives in globals.css
// under .dsp-* with the mockup's own variables, rather than mapped onto
// Tailwind's scale - mapping it is what made the first pass render at about
// 75% of the intended type sizes.
//
// Still read-only: Send Initial (N) opens the EXISTING wizard. Rewiring the
// one path that spends money is stage 3.
//
// Step 1 of the Deals tab redesign (Randy, Oct 7 2026): "Send Initial",
// "Updated <date>" on an edited page, the source pill under the facts, two
// disabled wave buttons, and three milestone rows with status dots. Step 2
// (waves log, follow-up and price-reduction pop-ups) lights the dim rows.

import { useState } from "react";
import type { DispoDeal, DispoFacts } from "@/actions/dispo-deals";
import { milestones, queuedDateLabel } from "@/lib/dispo/deals-view";

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

/** Where a JV deal's marketing page gets built: the existing creator,
 *  prefilled from the deal (Randy's flow, Oct 7 2026). */
const buildPageHref = (jvDealId: string) => `/app/marketing-page-creator/create?jv=${jvDealId}`;

function DealButtons({ deal }: { deal: DispoDeal }) {
  if (deal.kind === "jv") {
    // Once a page is linked it REPLACES the JV deal (email) button.
    return deal.pageUrl ? (
      <a className="dsp-b" href={deal.pageUrl} target="_blank" rel="noopener noreferrer">Marketing page</a>
    ) : (
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
          <span className="dsp-added">{queuedDateLabel(deal)}</span>
        </button>
        {deal.kind === "jv" && !deal.hasPage ? (
          // A JV deal with no page yet builds one first (Randy, Oct 7 2026).
          // No messages exist at this point; Send Initial appears once the
          // page is linked.
          <a className="dsp-send" href={buildPageHref(deal.id)}>Build page</a>
        ) : (
          <button
            type="button"
            className="dsp-send"
            disabled={!sendable}
            onClick={() => onSend(deal)}
            title={sendable ? undefined : "Needs a marketing page before it can be sent."}
          >
            Send Initial{deal.matchCount !== null ? ` (${deal.matchCount})` : ""}
          </button>
        )}
      </div>
      {open && (
        <div className="dsp-exp">
          <Facts facts={deal.facts} />
          {!deal.hasPage && (
            <p className="dsp-why">
              {deal.kind === "jv"
                ? "Build the marketing page to unlock Send Initial."
                : "Needs a marketing page before it can be sent."}
            </p>
          )}
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
      <div className="dsp-tile-src">
        <SrcPill kind={deal.kind} />
      </div>
      {/* Step 2 wires these to the follow-up and price-reduction pop-ups.
          Rendered disabled on purpose: no onClick, no modal yet. */}
      <div className="dsp-waves">
        <button type="button" className="dsp-b" disabled title="Coming soon">Send Follow-up</button>
        <button type="button" className="dsp-b" disabled title="Coming soon">Send Price Reduction</button>
      </div>
    </div>
    {/* Three columns (Randy, Oct 7): what, how many investors, when. A grid
        on the list with display:contents rows keeps the columns aligned. */}
    <ul className="dsp-miles" aria-label="Marketing milestones">
      {milestones(deal).map((m) => (
        <li key={m.key} className={`dsp-mile${m.done ? " done" : ""}`}>
          <span className="dsp-mile-l">
            <span className="dsp-dot" aria-hidden="true" />
            {m.label}
            <span className="sr-only">{m.done ? ", done" : ", not yet"}</span>
          </span>
          <span className="dsp-mile-n">{m.count}</span>
          <span className="dsp-mile-d">{m.date}</span>
        </li>
      ))}
    </ul>
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
