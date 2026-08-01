"use client";

// Agent round notes inside ACQ2 (spec 7/31).
//
// When a round is open these two sections REPLACE the flat list: every lead
// the agent wrote up lives in MECHANICAL or DECISIONS, mechanical first,
// because that is the order Randy reads them in. Read-only by construction -
// nothing here approves, actions or signals the agent. Randy reads on his
// phone and decides in chat.

import { motion, AnimatePresence } from "framer-motion";
import { AI_AGENT_COLOR, AI_AGENT_EMAIL, OWNER_EMAIL } from "@/lib/team";
import type { OpenRoundNote } from "@/actions/round-notes";
import { splitNoteBlocks, noteLines } from "@/lib/round-notes-format";

const SPRING = { type: "spring", stiffness: 320, damping: 32 } as const;

/**
 * Renders the agent's note.
 *
 * Presentation only. The hard rule from the spec is that ACQ2 never rewrites,
 * summarises or alters text - so this splits into paragraphs and gives the
 * "My call:" line its own emphasis, and does nothing else to the words.
 */
// One line of a note: bold segments rendered bold (the agent authors in
// markdown; showing the asterisks was fix-list item 3), bullets as bullets.
function NoteLineView({ line }: { line: ReturnType<typeof noteLines>[number] }) {
  const segs = line.segs.map((s, i) =>
    s.bold ? (
      <strong key={i} className="font-semibold text-neutral-900 dark:text-[#ededed]">{s.text}</strong>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
  if (!line.bullet) return <div className="whitespace-pre-wrap">{segs}</div>;
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 select-none opacity-40">•</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{segs}</span>
    </div>
  );
}

export function RoundNoteBody({ content }: { content: string }) {
  const blocks = splitNoteBlocks(content);

  return (
    <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-neutral-700 dark:text-[#d4d4d4]">
      {blocks.map((block, i) => {
        // "My call:" is the agent's one committed suggestion and the thing
        // Randy is actually looking for, so it gets weight. The text is
        // untouched either way.
        const isCall = block.isCall;
        return (
          <div
            key={i}
            className={
              isCall
                ? "rounded-lg px-3 py-2 font-medium text-neutral-900 dark:text-[#ededed]"
                : undefined
            }
            style={isCall ? { background: `${AI_AGENT_COLOR}14` } : undefined}
          >
            {noteLines(block.text).map((line, j) => (
              <NoteLineView key={j} line={line} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export type RoundRow = {
  note: OpenRoundNote;
  leadName: string;
  address: string | null;
  markers: string;
  board: string | null;
  /** Newest activity on the lead (agent-requests #1): whether the latest
   *  word is the agent's instruction or something new from Aldo changes how
   *  Randy reads the note, and he should not need the full record to tell. */
  lastUpdate: { name: string; email: string; at: string } | null;
  loadFailed: boolean;
  canOpen: boolean;
};

// Compact age for the last-update line: 3h ago, yesterday, then a date.
function agoShort(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// The same author identities the rest of the app renders: the AI Agent in
// purple, Randy as the gold Acquisitions Manager, everyone else plain.
function LastUpdateLine({ u }: { u: NonNullable<RoundRow["lastUpdate"]> }) {
  const who =
    u.email === AI_AGENT_EMAIL ? (
      <span className="font-semibold" style={{ color: AI_AGENT_COLOR }}>{u.name}</span>
    ) : u.email === OWNER_EMAIL ? (
      <span className="font-semibold text-[#8a6c00] dark:text-[#d4af37]">Acquisitions Manager</span>
    ) : (
      <span className="font-semibold">{u.name}</span>
    );
  return (
    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
      Last update: {who} · {agoShort(u.at)}
    </span>
  );
}

function SectionHeading({ label, count, hint }: { label: string; count: number; hint: string }) {
  return (
    <div className="px-1 pb-2 pt-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
          {label}
        </h2>
        <span className="text-[12px] tabular-nums text-neutral-400 dark:text-neutral-500">{count}</span>
      </div>
      <p className="pt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">{hint}</p>
    </div>
  );
}

function RoundRowCard({
  row,
  expanded,
  onToggle,
  onOpenRecord,
  index,
}: {
  row: RoundRow;
  expanded: boolean;
  onToggle: () => void;
  onOpenRecord: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.4), ...SPRING }}
      className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#262626]"
    >
      <div className="flex items-stretch">
        {/* Tapping the row expands and collapses. Deliberately NOT
            "tap again opens the record": once a note is open, the obvious
            second tap is the one that closes it again, and hijacking that
            to navigate away would strand Randy mid-read. The record is one
            gesture away via the chevron or the button in the panel. */}
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04]"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold leading-snug">{row.leadName}</div>
            <div className="mt-1 flex items-center gap-2">
              {row.board && (
                <span className="rounded-md bg-[#5c6e2d]/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5c6e2d] dark:bg-[#5c6e2d]/25 dark:text-[#c5cca8]">
                  {row.board}
                </span>
              )}
              {row.loadFailed ? (
                <span className="truncate text-[12px] text-red-500">couldn&apos;t load</span>
              ) : (
                <span className="truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                  {row.address || "no address on file"}
                </span>
              )}
            </div>
          </div>
          {row.markers && <span className="shrink-0 text-[19px] leading-none">{row.markers}</span>}
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            className="shrink-0 text-neutral-300 dark:text-neutral-600"
            width="13" height="8" viewBox="0 0 13 8" fill="none"
          >
            <path d="M1 1l5.5 5.5L12 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </button>

        {/* the open affordance: full record, one gesture, from collapsed or expanded */}
        <button
          onClick={onOpenRecord}
          disabled={!row.canOpen}
          aria-label={`Open ${row.leadName} record`}
          className="grid w-11 shrink-0 place-items-center border-l border-black/[0.05] text-neutral-300 active:bg-black/[0.03] disabled:opacity-30 dark:border-white/[0.07] dark:text-neutral-600 dark:active:bg-white/[0.04]"
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="border-t px-4 pb-4 pt-3.5"
              style={{ borderColor: `${AI_AGENT_COLOR}26` }}
            >
              {/* No "AI" badge (agent-requests #2): every note is the
                  agent's, so the label never varied and read as contradicting
                  a "Last update: Aldo Gallegos" line beneath it. The purple
                  top border carries the authorship instead. */}
              {row.lastUpdate && (
                <div className="pb-2.5">
                  <LastUpdateLine u={row.lastUpdate} />
                </div>
              )}
              <RoundNoteBody content={row.note.content} />
              {row.canOpen && (
                <button
                  onClick={onOpenRecord}
                  className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-black/[0.04] py-2.5 text-[14px] font-semibold text-neutral-600 active:scale-[0.98] dark:bg-white/[0.06] dark:text-neutral-300"
                >
                  Open full record
                  <svg width="7" height="12" viewBox="0 0 8 14" fill="none">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function RoundSections({
  mechanical,
  decisions,
  expandedId,
  onToggle,
  onOpenRecord,
}: {
  mechanical: RoundRow[];
  decisions: RoundRow[];
  expandedId: string | null;
  onToggle: (leadId: string) => void;
  onOpenRecord: (leadId: string) => void;
}) {
  let i = 0;
  const section = (rows: RoundRow[], label: string, hint: string) =>
    rows.length === 0 ? null : (
      <>
        <SectionHeading label={label} count={rows.length} hint={hint} />
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <RoundRowCard
              key={row.note.lead_id}
              row={row}
              index={i++}
              expanded={expandedId === row.note.lead_id}
              onToggle={() => onToggle(row.note.lead_id)}
              onOpenRecord={() => onOpenRecord(row.note.lead_id)}
            />
          ))}
        </div>
      </>
    );

  return (
    <div>
      {section(mechanical, "Mechanical", "The answer already exists. One line each.")}
      {section(decisions, "Decisions", "These need your call.")}
    </div>
  );
}

/** The note pinned to the top of a lead record during a round. */
export function PinnedRoundNote({ note }: { note: OpenRoundNote }) {
  return (
    <section
      className="rounded-2xl border bg-white p-4 dark:bg-[#262626]"
      style={{ borderColor: `${AI_AGENT_COLOR}40` }}
    >
      {/* purple heading rather than an "AI" badge (agent-requests #2) */}
      <div
        className="mb-2.5 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: AI_AGENT_COLOR }}
      >
        Round note · {note.section === "mechanical" ? "Mechanical" : "Decision"}
      </div>
      <RoundNoteBody content={note.content} />
    </section>
  );
}
