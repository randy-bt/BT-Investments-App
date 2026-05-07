"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import {
  generateLeadBrief,
  postUpNextNote,
  upNextTriggerFollowUp,
  upNextCloseLead,
  type UpNextItem,
  type UpNextProperty,
} from "@/actions/up-next";
import { GoogleMap } from "@/components/GoogleMap";

// County assessor URL templates — APN replaces %s. Mirrors the table
// in PropertyCard.tsx; kept inline here to avoid wiring up a shared lib
// for one helper.
const COUNTY_URLS: Record<string, string> = {
  king: "https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s",
  pierce: "https://atip.piercecountywa.gov/#/app/propertyDetail/%s/summary",
  snohomish: "https://www.snoco.org/proptax/search.aspx?parcel_number=%s",
  thurston: "https://tcproperty.co.thurston.wa.us/propsql/basic.asp?pn=%s",
  kitsap: "https://psearch.kitsapgov.com/details.asp?RPID=%s",
  skagit: "https://www.skagitcounty.net/Search/Property/?id=%s",
};

function countyUrl(county: string | null, apn: string | null): string | null {
  if (!county || !apn) return null;
  const t = COUNTY_URLS[county.toLowerCase()];
  return t ? t.replace("%s", apn) : null;
}

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
  // Restore cursor from sessionStorage if the user navigated away and
  // came back. We persist by lead id (not raw index) so a queue change
  // doesn't snap us to the wrong card.
  const [cursor, setCursor] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const savedId = window.sessionStorage.getItem("up-next:lead-id");
    if (!savedId) return 0;
    const idx = initialQueue.findIndex((q) => q.leadId === savedId);
    return idx >= 0 ? idx : 0;
  });
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
  const [showExpandedNote, setShowExpandedNote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = queue[cursor];
  const remaining = queue.length - cursor;
  const briefFetchedRef = useRef<Set<string>>(new Set());

  // Auto-generate brief on card open if needed.
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
          setBriefByLead((prev) => ({
            ...prev,
            [current.leadId]: r.data.briefText,
          }));
        } else {
          setError(r.error);
        }
      })
      .finally(() => {
        setBriefLoadingFor(null);
      });
  }, [current, briefByLead]);

  useEffect(() => {
    setNoteText("");
    setError(null);
    setPage(1);
    // Persist the current lead id so re-entry to /app/up-next picks
    // up where the user left off.
    if (typeof window !== "undefined") {
      const id = queue[cursor]?.leadId;
      if (id) window.sessionStorage.setItem("up-next:lead-id", id);
      else window.sessionStorage.removeItem("up-next:lead-id");
    }
  }, [cursor, queue]);

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

  // Drag gestures. Left = skip, right = open expanded-note popup, up =
  // open the lead's full record. The card follows the finger on the
  // active axis (locked at drag start), animates off-screen past the
  // threshold, otherwise springs back.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-6, 0, 6]);
  const dragOpacity = useTransform(x, [-320, -160, 0, 160, 320], [0, 1, 1, 1, 0.5]);

  // Lighter, livelier spring than v4.10's defaults. Lower stiffness +
  // softer damping makes the snap-back feel buoyant rather than rigid.
  const SOFT_SPRING = { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.7 };

  // Drag-to-expose: pulling the handle down grows the map height and
  // shrinks the body underneath. Snaps to either fully closed (0) or
  // a generous reveal on release.
  const MAP_EXTRA_MAX = 180;
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const mapBaseHeight = isNarrow ? 110 : 280;
  const mapExtra = useMotionValue(0);
  const mapHeight = useTransform(mapExtra, (v) => `${mapBaseHeight + v}px`);

  // Pan accumulator. Using onPan instead of drag keeps the nub in
  // place visually — only the map height changes — so the handle
  // can't drift down into the body content.
  const panStartRef = useRef(0);
  function endMapDrag() {
    const target = mapExtra.get() > MAP_EXTRA_MAX / 2 ? MAP_EXTRA_MAX : 0;
    animate(mapExtra, target, SOFT_SPRING);
  }

  function springBack() {
    animate(x, 0, SOFT_SPRING);
    animate(y, 0, SOFT_SPRING);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const T = 90; // lower threshold so a casual flick triggers
    const VELOCITY_T = 600; // velocity also triggers (silky flick feel)
    const dx = info.offset.x;
    const dy = info.offset.y;
    const vx = info.velocity.x;
    const vy = info.velocity.y;
    const screenW = typeof window !== "undefined" ? window.innerWidth : 600;
    const screenH = typeof window !== "undefined" ? window.innerHeight : 800;

    // Vertical-dominant: swipe up → open full record
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -T || vy < -VELOCITY_T) {
        animate(y, -screenH, {
          type: "tween",
          ease: [0.16, 1, 0.3, 1],
          duration: 0.42,
          onComplete: () => {
            router.push(
              `/app/acquisitions/lead-record/${current.leadId}`,
            );
          },
        });
        return;
      }
      springBack();
      return;
    }

    // Horizontal-dominant
    if (dx < -T || vx < -VELOCITY_T) {
      animate(x, -screenW * 0.9, {
        type: "tween",
        ease: [0.16, 1, 0.3, 1],
        duration: 0.36,
        onComplete: () => {
          skip();
          x.set(0);
        },
      });
      return;
    }
    if (dx > T || vx > VELOCITY_T) {
      // Right-swipe → spring back smoothly, then open expanded note.
      springBack();
      setTimeout(() => setShowExpandedNote(true), 80);
      return;
    }
    springBack();
  }

  // Tap halves of the card on mobile to navigate. Ignored when the
  // tap originates from an interactive element (input, button, link).
  function onCardClick(e: React.MouseEvent<HTMLElement>) {
    const interactive = (e.target as HTMLElement).closest(
      "button, a, input, textarea, [data-interactive]",
    );
    if (interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setPage(x > rect.width / 2 ? 2 : 1);
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
  const today = new Date();
  const day = today.getDate().toString().padStart(2, "0");
  const monthShort = today
    .toLocaleString("en-US", { month: "short" })
    .toLowerCase();

  // Pretty-format asking. Strip non-numerics for currency formatting; if it's
  // free-text fall back to whatever's there.
  const askingFormatted = (() => {
    const raw = current.asking_price;
    if (!raw) return null;
    const numeric = Number(String(raw).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(numeric) && numeric > 0) {
      return `$${numeric.toLocaleString()}`;
    }
    return raw;
  })();

  const ourOfferFormatted =
    current.our_current_offer != null
      ? `$${current.our_current_offer.toLocaleString()}`
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-3 sm:px-6 py-4">
      <header className="flex items-center justify-between mb-3 px-1">
        <Link
          href="/app"
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Home
        </Link>
        <h1 className="text-base font-semibold tracking-tight">Up Next</h1>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600 tabular-nums">
          {remaining} left
        </span>
      </header>

      {/* Card + actions + dots are one vertically-centered group so the
          card and the buttons read as a single unit, not separate
          things floating apart. */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
      {/* Card row: chevron buttons (desktop only) flank the card. On
          mobile the chevrons are hidden — tapping the card halves
          drives navigation instead. */}
      <div className="flex w-full items-start justify-center gap-2">
        {/* Skip = double-left chevron, sits to the left of the prev-page
            chevron on desktop. Bolder than the page chevrons so it
            clearly reads as "send this card back, not just turn page." */}
        <button
          type="button"
          onClick={skip}
          aria-label="Skip to next lead"
          disabled={isPending || queue.length <= 1}
          className="hidden sm:flex w-10 flex-shrink-0 items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setPage(1)}
          aria-label="Previous page"
          disabled={page === 1}
          className="hidden sm:flex w-10 flex-shrink-0 items-center justify-center text-neutral-300 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* The card itself — dark surface always, regardless of the
            site theme. Matches the reference look. */}
        {/* Stack wrapper: holds the active card plus up to two ghost
            cards rendered behind it for the Tinder-style queue feel.
            The active card defines the wrapper's height; ghosts use
            inset-0 to match. */}
        <div className="relative w-[78%] max-w-[540px] sm:w-full">
          {queue[cursor + 2] && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl border border-white/10 bg-[#1d1d1d] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]"
              style={{
                transform: "translate(8px, 18px) rotate(2.5deg) scale(0.93)",
                opacity: 0.7,
                zIndex: 0,
              }}
            />
          )}
          {queue[cursor + 1] && (
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.55)]"
              style={{
                transform: "translate(-6px, 10px) rotate(-1.8deg) scale(0.96)",
                opacity: 0.85,
                zIndex: 1,
              }}
            />
          )}
          <motion.article
          onClick={onCardClick}
          drag
          dragDirectionLock
          dragElastic={0.28}
          dragMomentum={false}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.02 }}
          style={{
            x,
            y,
            rotate,
            opacity: dragOpacity,
            willChange: "transform",
            zIndex: 2,
          }}
          className="card-sized relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#161616] text-white min-w-0 cursor-grab active:cursor-grabbing sm:min-h-[640px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.55),0_8px_24px_-8px_rgba(0,0,0,0.45)]"
          key={current.leadId}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          {/* Map with name + address overlay top-right. A dark
              top-down gradient sits between the map and the overlay
              text so the white/cyan stays readable over bright
              satellite imagery. The height is a motion value so the
              user can drag the handle below to expose more map. */}
          <motion.div
            data-interactive
            className="relative flex-shrink-0 overflow-hidden"
            style={{ height: mapHeight }}
          >
            {current.addresses[0] ? (
              <GoogleMap address={current.addresses[0]} />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-xs text-neutral-500">
                No address on file
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />
            <div className="pointer-events-none absolute right-4 top-4 max-w-[68%] text-right">
              <div className="flex items-center justify-end gap-1.5">
                {/* Lead names in the DB already include their leading
                    diamond emoji, so don't add another. */}
                <span className="font-semibold text-white">
                  {current.leadName}
                </span>
              </div>
              {current.addresses.map((addr, i) => (
                <div
                  key={i}
                  className="text-cyan-300 text-xs mt-0.5"
                >
                  {addr}
                </div>
              ))}
              <Link
                href={`/app/acquisitions/lead-record/${current.leadId}`}
                className="pointer-events-auto inline-block mt-1 text-[10px] text-white/70 hover:text-white"
              >
                Open full record →
              </Link>
            </div>
          </motion.div>

          {/* Drag handle — pull DOWN to grow the map and shrink the
              info sheet underneath. Uses onPan rather than drag so the
              nub itself never moves; only the map height responds.
              Snaps to closed (0) or fully open on release. */}
          <motion.div
            data-interactive
            onPanStart={() => {
              panStartRef.current = mapExtra.get();
            }}
            onPan={(_, info) => {
              const next = Math.max(
                0,
                Math.min(MAP_EXTRA_MAX, panStartRef.current + info.offset.y),
              );
              mapExtra.set(next);
            }}
            onPanEnd={endMapDrag}
            className="flex justify-center relative z-10 cursor-grab active:cursor-grabbing py-2 -mt-2"
            style={{ touchAction: "none" }}
          >
            <div className="h-1.5 w-12 rounded-full bg-white/40" />
          </motion.div>

          {/* Body — switches by page with a soft horizontal slide. */}
          <div className="flex-1 px-4 pt-2 pb-3 sm:px-6 sm:pt-4 sm:pb-6 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${current.leadId}-${page}`}
                initial={{ opacity: 0, x: page === 2 ? 32 : -32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: page === 2 ? -32 : 32 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="space-y-2 sm:space-y-5"
              >
            {page === 1 ? (
              <>
                {/* Milestone timeline — slim horizontal progress strip
                    so the user can see where the deal sits without
                    leaving the card. */}
                <MilestoneTimeline current={current} />

                {/* Asking + Range */}
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="Asking" value={askingFormatted} />
                  <Stat label="Range" value={current.range} />
                </div>

                {/* Property details — sqft, lot, parcel. Parcel links
                    to the county assessor when both county + apn are
                    present. Falls back to plain text otherwise. */}
                <PropertyDetails properties={current.properties} />

                <Block label="Condition" value={current.condition} />
                <Block label="Occupancy" value={current.occupancy_status} />
                {current.our_current_offer != null && (
                  <Block label="Our offer" value={ourOfferFormatted} />
                )}

                {/* Google search shortcut — one G per property. */}
                <GoogleShortcuts properties={current.properties} />

                <BriefBox
                  briefText={briefText}
                  isLoading={isBriefLoading}
                />
              </>
            ) : (
              <>
                <BriefBox briefText={briefText} isLoading={isBriefLoading} />
                {current.recentUpdates.length > 0 ? (
                  <div>
                    <div className="text-neutral-500 text-xs mb-2">
                      Recent activity
                    </div>
                    <ul className="space-y-2">
                      {current.recentUpdates.map((u, i) => (
                        <li
                          key={i}
                          className="rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm text-white/85 whitespace-pre-wrap"
                        >
                          <div className="text-[10px] text-white/40 mb-1">
                            {u.author_name} ·{" "}
                            {new Date(u.created_at).toLocaleString()}
                          </div>
                          {u.content.length > 240
                            ? u.content.slice(0, 240) + "…"
                            : u.content}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-white/40 italic">
                    No activity recorded yet.
                  </p>
                )}
              </>
            )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom ribbon: date pill + status update input. Sits at the
              bottom of the card on every page. */}
          <div
            data-interactive
            className="border-t border-white/10 bg-black/30 px-5 py-2 sm:py-3 flex items-center gap-3"
          >
            <div className="flex flex-col items-center text-white leading-none">
              <div className="text-2xl font-bold tabular-nums">{day}</div>
              <div className="text-[10px] uppercase text-white/60 tracking-wide">
                {monthShort}
              </div>
            </div>
            <div className="w-px self-stretch bg-white/10" />
            <textarea
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePostNote();
                }
              }}
              placeholder="Add a note…"
              rows={1}
              disabled={isPending}
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-white/40 outline-none disabled:opacity-50 max-h-32"
            />
            <button
              type="button"
              onClick={handlePostNote}
              disabled={isPending || !noteText.trim()}
              aria-label="Post update"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          </motion.article>
        </div>

        <button
          type="button"
          onClick={() => setPage(2)}
          aria-label="Next page"
          disabled={page === 2}
          className="hidden sm:flex w-10 flex-shrink-0 items-center justify-center text-neutral-300 hover:text-neutral-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Big circular action buttons */}
      <div className="flex items-center justify-center gap-6 sm:gap-10">
        <CircleAction
          label="+1 Week"
          tone="yellow"
          onClick={() => handleFollowUp("1week")}
          disabled={isPending}
          icon={<CalendarIcon />}
        />
        <CircleAction
          label="+1 Month"
          tone="yellow"
          onClick={() => handleFollowUp("1month")}
          disabled={isPending}
          icon={<CalendarIcon />}
        />
        <CircleAction
          label="Close lead"
          tone="red"
          onClick={handleClose}
          disabled={isPending}
          icon={<XIcon />}
        />
      </div>

      {/* Bottom Skip text removed — mobile users skip by swipe-left,
          desktop users use the double-left chevron next to the
          prev-page chevron. */}

      <div className="flex items-center justify-center gap-1.5">
        {[1, 2].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p as 1 | 2)}
            aria-label={`Go to page ${p}`}
            className={`h-1.5 rounded-full transition-all ${
              page === p
                ? "w-5 bg-neutral-700"
                : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
            }`}
          />
        ))}
      </div>
      </div>

      {error && (
        <div className="mt-3 mx-auto max-w-md rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Expanded-note modal — same input as the bottom ribbon, just
          much larger. Triggered by swipe-right on the card. */}
      <AnimatePresence>
        {showExpandedNote && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowExpandedNote(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-[#161616] text-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-white/50">
                    Update for
                  </div>
                  <div className="font-semibold mt-0.5">{current.leadName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExpandedNote(false)}
                  aria-label="Close"
                  className="text-white/50 hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <textarea
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type the full update… posts to the activity feed and clears the checkmark."
                rows={8}
                disabled={isPending}
                className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-editable text-white placeholder:text-white/40 resize-none outline-none focus:border-white/30 disabled:opacity-50"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpandedNote(false)}
                  disabled={isPending}
                  className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePostNote();
                    setShowExpandedNote(false);
                  }}
                  disabled={isPending || !noteText.trim()}
                  className="rounded-full bg-cyan-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
                >
                  {isPending ? "Posting…" : "Post update"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function MilestoneTimeline({ current }: { current: UpNextItem }) {
  return (
    <div className="flex items-start">
      {MILESTONES.map((m, i) => {
        const active = !!current[m.key];
        const isLast = i === MILESTONES.length - 1;
        return (
          <div
            key={m.label}
            className={`flex items-start ${isLast ? "" : "flex-1"}`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 ${
                  active
                    ? "bg-cyan-400 border-cyan-400"
                    : "bg-transparent border-white/30"
                }`}
              />
              <div
                className={`text-[9px] mt-1 ${
                  active ? "text-cyan-300 font-medium" : "text-white/40"
                }`}
              >
                {m.label}
              </div>
            </div>
            {!isLast && (
              <div
                className={`flex-1 h-[2px] mt-[4px] mx-1 ${
                  active ? "bg-cyan-400" : "bg-white/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PropertyDetails({
  properties,
}: {
  properties: UpNextProperty[];
}) {
  // Aggregate first property's stats; if multiple properties exist,
  // show indicators that they're per-property below.
  const first = properties[0];
  if (!first) return null;
  const url = countyUrl(first.county, first.apn);

  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <div className="text-white/50 text-[11px]">Sqft</div>
        <div className="text-white/90 mt-0.5">
          {first.sqft != null ? first.sqft.toLocaleString() : "—"}
        </div>
      </div>
      <div>
        <div className="text-white/50 text-[11px]">Lot</div>
        <div className="text-white/90 mt-0.5">{first.lot_size ?? "—"}</div>
      </div>
      <div>
        <div className="text-white/50 text-[11px]">Parcel</div>
        <div className="mt-0.5">
          {first.apn ? (
            url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:underline"
              >
                {first.apn}
              </a>
            ) : (
              <span className="text-white/90">{first.apn}</span>
            )
          ) : (
            <span className="text-white/90">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleShortcuts({
  properties,
}: {
  properties: UpNextProperty[];
}) {
  const withAddresses = properties.filter((p) => p.address);
  if (withAddresses.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      {withAddresses.map((p) => (
        <a
          key={p.id}
          href={`https://www.google.com/search?q=${encodeURIComponent(p.address!)}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Search "${p.address}" on Google`}
          className="font-bold text-white/60 hover:text-white"
        >
          G
        </a>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-white/50 text-xs">{label}</div>
      <div className="font-semibold text-white text-base sm:text-xl mt-0.5 break-words">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-white/50 text-xs mb-1">{label}</div>
      <div className="text-white/90 text-sm leading-relaxed">
        {value ?? "—"}
      </div>
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
    <div>
      <div className="text-white/50 text-[11px] uppercase tracking-wide mb-1.5">
        Deal snapshot
      </div>
      <div className="rounded-md border border-cyan-700/40 bg-cyan-500/5 px-3 py-2 sm:py-3 flex gap-2">
        <span className="text-cyan-400 text-base leading-none mt-0.5">✨</span>
        <p className="text-cyan-200 text-[13px] sm:text-sm leading-snug sm:leading-relaxed">
          {isLoading ? (
            <span className="italic text-cyan-300/60">Generating snapshot…</span>
          ) : briefText ? (
            briefText
          ) : (
            <span className="italic text-cyan-300/60">No snapshot available.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function CircleAction({
  label,
  tone,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  tone: "yellow" | "red";
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "yellow"
      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
      : "bg-red-100 text-red-600 hover:bg-red-200";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 disabled:opacity-50 disabled:cursor-default"
    >
      <span
        className={`flex h-16 w-16 sm:h-[68px] sm:w-[68px] items-center justify-center rounded-full transition-colors ${toneClass}`}
      >
        {icon}
      </span>
      <span className="text-[11px] text-neutral-600">{label}</span>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
