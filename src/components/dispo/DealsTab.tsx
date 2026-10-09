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

import { useCallback, useEffect, useRef, useState } from "react";
import type { DispoDeal, DispoFacts } from "@/actions/dispo-deals";
import { milestones, queuedDateLabel, type Milestone } from "@/lib/dispo/deals-view";

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

/** One milestone row. The JV row carries an app-drawn bubble (Randy,
 *  Oct 9 2026) listing each partner with its send date and note: the whole
 *  row is the target, hover opens it on a mouse, a tap toggles it on touch,
 *  and mouse-out, tap-outside or Escape closes it. */
function MilestoneRow({ m }: { m: Milestone }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  // The tile clips its overflow (rounded card), so the bubble is fixed to
  // the viewport, anchored under the row's label, flipped above when the
  // row sits near the bottom of the window. Position is computed in the
  // open handler and on scroll/resize, never synchronously in an effect.
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const hasBubble = !!m.partners?.length;
  const partnerCount = m.partners?.length ?? 0;

  const place = useCallback(() => {
    const r = labelRef.current?.getBoundingClientRect();
    if (!r) return;
    const estimated = 60 + 34 * partnerCount;
    const up = r.bottom + 8 + estimated > window.innerHeight && r.top > estimated;
    const left = Math.min(r.left, Math.max(8, window.innerWidth - 280));
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left, up });
  }, [partnerCount]);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (open) setOpen(false);
    else show();
  }, [open, show]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) hide();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, hide, place]);

  const popId = `dsp-pop-${m.key}`;
  return (
    <li
      ref={rowRef}
      className={`dsp-mile${m.done ? " done" : ""}${hasBubble ? " has-pop" : ""}${open ? " open" : ""}`}
      onPointerEnter={hasBubble ? (e) => { if (e.pointerType === "mouse") show(); } : undefined}
      onPointerLeave={hasBubble ? (e) => { if (e.pointerType === "mouse") hide(); } : undefined}
      onClick={hasBubble ? toggle : undefined}
    >
      <span className="dsp-mile-l" ref={labelRef}>
        <span className="dsp-dot" aria-hidden="true" />
        {m.key === "price_reduction" ? (
          // Three forms by tile width (container queries in globals.css):
          // wide "Price reduction to $___", mid "Price reduction", narrow "Price cut".
          <>
            <span className="dsp-l-long">{m.label}</span>
            <span className="dsp-l-mid">Price reduction</span>
            <span className="dsp-l-short">Price cut</span>
          </>
        ) : m.key === "follow_up" ? (
          <>
            <span className="dsp-l-long dsp-l-mid">{m.label}</span>
            <span className="dsp-l-short">Follow-up</span>
          </>
        ) : (
          m.label
        )}
        <span className="sr-only">{m.done ? ", done" : ", not yet"}</span>
        {hasBubble && open && (
          <div
            className="dsp-pop"
            role="dialog"
            id={popId}
            aria-label={`${m.label}: partners`}
            style={{ top: pos.top, left: pos.left, transform: pos.up ? "translateY(-100%)" : undefined }}
          >
            <div className="dsp-pop-h">{m.count}</div>
            <ul className="dsp-pop-list">
              {m.partners!.map((p, i) => (
                <li key={`${p.name}-${i}`} className="dsp-pop-row">
                  <span className="dsp-pop-name">
                    {p.name}
                    {p.note && <span className="dsp-pop-note">{p.note}</span>}
                  </span>
                  <span className="dsp-pop-date">{p.date}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </span>
      {hasBubble ? (
        <button
          type="button"
          className="dsp-mile-n dsp-mile-btn"
          aria-expanded={open}
          aria-controls={popId}
          onClick={(e) => e.stopPropagation()}
          onPointerUp={toggle}
        >
          {m.count}
        </button>
      ) : (
        <span className="dsp-mile-n">{m.count}</span>
      )}
      <span className="dsp-mile-d">
        <span className="dsp-d-long">{m.date}</span>
        <span className="dsp-d-short">{m.dateShort}</span>
      </span>
    </li>
  );
}

const ActiveTile = ({ deal, onSend }: { deal: DispoDeal; onSend: (d: DispoDeal) => void }) => (
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
      {/* A deal reaches Active on a JV send too (Randy, Oct 9 2026). Until
          investors have been sent, the tile keeps the Send Initial button
          so that send is never hidden behind the move. */}
      {deal.sentCount === 0 && (
        <div className="dsp-tile-send">
          {deal.kind === "jv" && !deal.hasPage ? (
            <a className="dsp-send" href={buildPageHref(deal.id)}>Build page</a>
          ) : (
            <button
              type="button"
              className="dsp-send"
              disabled={!deal.hasPage}
              onClick={() => onSend(deal)}
              title={deal.hasPage ? undefined : "Needs a marketing page before it can be sent."}
            >
              Send Initial{deal.matchCount !== null ? ` (${deal.matchCount})` : ""}
            </button>
          )}
        </div>
      )}
      {/* Step 2 wires these to the follow-up and price-reduction pop-ups.
          Rendered disabled on purpose: no onClick, no modal yet. */}
      <div className="dsp-waves">
        <button type="button" className="dsp-b" disabled title="Coming soon" aria-label="Send Follow-up">
          <span className="dsp-l-long dsp-l-mid">Send Follow-up</span><span className="dsp-l-short">Follow-up</span>
        </button>
        <button type="button" className="dsp-b" disabled title="Coming soon" aria-label="Send Price Reduction">
          <span className="dsp-l-long dsp-l-mid">Send Price Reduction</span><span className="dsp-l-short">Price Reduction</span>
        </button>
      </div>
    </div>
    {/* Three columns (Randy, Oct 7): what, how many investors, when. A grid
        on the list with display:contents rows keeps the columns aligned. */}
    <ul className="dsp-miles" aria-label="Marketing milestones">
      {milestones(deal).map((m) => (
        <MilestoneRow key={m.key} m={m} />
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
            {active.map((d) => <ActiveTile key={`${d.kind}-${d.id}`} deal={d} onSend={onSend} />)}
          </div>
        )}
      </section>
    </div>
  );
}
