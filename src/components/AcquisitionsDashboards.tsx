"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { InlineSearch } from "@/components/InlineSearch";
import { useAuth } from "@/components/AuthProvider";
import { triggerFollowUp } from "@/actions/follow-up";
import type { EntityLookup } from "@/actions/entity-lookup";

type SeededNote = { content: string; updatedAt: string };

type Props = {
  entityLookup: EntityLookup[];
  initialNotes?: {
    /** The retired ACQ board (Oct 9, 2026); ignored if still passed. */
    acquisitions?: SeededNote;
    acquisitions_b: SeededNote;
    follow_ups: SeededNote;
  };
};

export function AcquisitionsDashboards({ entityLookup, initialNotes }: Props) {
  const { isAdmin } = useAuth();
  const [aacqCount, setAacqCount] = useState(0);
  const [fuCount, setFuCount] = useState(0);
  // Matched entity IDs reported by each dashboard. Re-fired live as the
  // user edits, so the discrepancy badge stays accurate.
  const [aacqIds, setAacqIds] = useState<string[]>([]);
  const [fuIds, setFuIds] = useState<string[]>([]);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  const handleAacqCount = useCallback((c: number) => setAacqCount(c), []);
  const handleFuCount = useCallback((c: number) => setFuCount(c), []);
  const handleAacqIds = useCallback((ids: string[]) => setAacqIds(ids), []);
  const handleFuIds = useCallback((ids: string[]) => setFuIds(ids), []);

  const total = aacqCount + fuCount;

  // Active leads from the DB (entityLookup is filtered to active by the
  // server action). Anything in this list whose id isn't claimed by
  // either dashboard is a discrepancy — it's in the system but not on a
  // board, so it would be missed in the daily review.
  const discrepancies = useMemo(() => {
    const matched = new Set<string>([...aacqIds, ...fuIds]);
    return entityLookup
      .filter((e) => e.type === "lead" && !matched.has(e.id))
      .map((e) => ({ id: e.id, name: e.name }));
  }, [entityLookup, aacqIds, fuIds]);

  // A lead inflates the total when it's claimed more than once — either
  // by the same dashboard (typo / paste) or by multiple dashboards.
  // Surface both so the user can prune the dashboard text down to one
  // entry per lead.
  const duplicates = useMemo(() => {
    const perBoard = new Map<string, Map<string, number>>();
    const bump = (id: string, board: string) => {
      let row = perBoard.get(id);
      if (!row) {
        row = new Map();
        perBoard.set(id, row);
      }
      row.set(board, (row.get(board) ?? 0) + 1);
    };
    aacqIds.forEach((id) => bump(id, "Acquisitions"));
    fuIds.forEach((id) => bump(id, "Follow-ups"));
    const lookupById = new Map(entityLookup.map((e) => [e.id, e.name]));
    return Array.from(perBoard.entries())
      .filter(([, row]) => Array.from(row.values()).reduce((a, b) => a + b, 0) > 1)
      .map(([id, row]) => ({
        id,
        name: lookupById.get(id) ?? "(unknown)",
        breakdown: Array.from(row.entries())
          .map(([board, n]) => (n > 1 ? `${board} (${n}×)` : board))
          .join(" + "),
      }));
  }, [aacqIds, fuIds, entityLookup]);

  const followUpGutter = isAdmin
    ? {
        onClickAction: async (entityId: string, offset: "1week" | "1month") => {
          const r = await triggerFollowUp(entityId, offset);
          if (!r.success) {
            alert(`Follow-up failed: ${r.error}`);
            return;
          }
          if (!r.data.moved) {
            alert(
              `Follow-up date set, but "${r.data.leadName}" wasn't found on the Acquisitions Dashboard text, so nothing was moved.`
            );
          }
          setReloadSignal((n) => n + 1);
        },
      }
    : undefined;

  return (
    <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
      {/* The ACQ board above this one was retired Oct 9, 2026 (Randy). The
          lead search and the follow-up gutter it carried now live here. */}
      <CollapsibleDashboard
        title="Acquisitions Dashboard"
        module="acquisitions_b"
        entityLookup={entityLookup}
        showFlagged
        titleRight={<div className="w-[30%]"><InlineSearch mode="leads" /></div>}
        onCountChange={handleAacqCount}
        onMatchedIdsChange={handleAacqIds}
        followUpGutter={followUpGutter}
        defaultOpen
        reloadSignal={reloadSignal}
        initialContent={initialNotes?.acquisitions_b.content}
        initialUpdatedAt={initialNotes?.acquisitions_b.updatedAt}
      />
      <div className="border-t border-dashed border-neutral-300 pt-4">
        <CollapsibleDashboard
          title="Follow-ups Dashboard"
          module="follow_ups"
          entityLookup={entityLookup}
          onCountChange={handleFuCount}
          onMatchedIdsChange={handleFuIds}
          reloadSignal={reloadSignal}
          initialContent={initialNotes?.follow_ups.content}
          initialUpdatedAt={initialNotes?.follow_ups.updatedAt}
        />
      </div>
      <div className="border-t border-dashed border-neutral-300 pt-2 text-xs text-neutral-400 flex flex-col gap-1">
        <div>Total lead records: {total}</div>
        {discrepancies.length === 0 ? (
          duplicates.length === 0 ? (
            <div className="text-[11px] text-emerald-600">No discrepancies</div>
          ) : (
            <div className="text-[11px] text-amber-600">
              No discrepancies, but{" "}
              <button
                type="button"
                onClick={() => setDuplicateOpen((o) => !o)}
                className="underline-offset-2 hover:underline focus:outline-none"
                aria-expanded={duplicateOpen}
              >
                {duplicates.length}{" "}
                {duplicates.length === 1 ? "duplicate" : "duplicates"}
                {" — "}
                {duplicateOpen ? "hide" : "show"} {duplicates.length === 1 ? "lead" : "leads"}
              </button>
              {duplicateOpen && (
                <ul className="mt-1.5 ml-2 flex flex-col gap-0.5">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/app/acquisitions/lead-record/${d.id}`}
                        className="text-amber-700 hover:underline"
                      >
                        {d.name}
                      </Link>
                      <span className="text-amber-700/70">
                        {" "}— on {d.breakdown}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        ) : (
          <div className="text-[11px] text-orange-600">
            <button
              type="button"
              onClick={() => setDiscrepancyOpen((o) => !o)}
              className="underline-offset-2 hover:underline focus:outline-none"
              aria-expanded={discrepancyOpen}
            >
              {discrepancies.length}{" "}
              {discrepancies.length === 1 ? "discrepancy" : "discrepancies"}
              {" — "}
              {discrepancyOpen ? "hide" : "show"} {discrepancies.length === 1 ? "lead" : "leads"}
            </button>
            {discrepancyOpen && (
              <ul className="mt-1.5 ml-2 flex flex-col gap-0.5">
                {discrepancies.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/app/acquisitions/lead-record/${d.id}`}
                      className="text-orange-700 hover:underline"
                    >
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
