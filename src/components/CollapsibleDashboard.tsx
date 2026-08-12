"use client";

import { useState, useEffect, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { Collapsible } from "@/components/Collapsible";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { countEntityMatches, getEntityMatchIds, getFlagBreakdown } from "@/lib/count-matches";
import type { FlagBreakdown } from "@/lib/flagged-lines";
import { FlaggedBadge } from "@/components/FlaggedBadge";
import type { EntityLookup } from "@/actions/entity-lookup";

type CollapsibleDashboardProps = {
  title: string;
  module: Parameters<typeof DashboardNotes>[0]["module"];
  entityLookup?: EntityLookup[];
  compact?: boolean;
  titleRight?: React.ReactNode;
  onCountChange?: (count: number) => void;
  /** Show the flagged-lead badge (Randy 8/10). Opt-in, because this component
   *  also renders the Dispositions, Investor Database and JV boards, where a
   *  flag count means nothing. */
  showFlagged?: boolean;
  /** Fires alongside onCountChange with the matched entity IDs from
   *  this dashboard's note. Used by the acquisitions reconcile badge. */
  onMatchedIdsChange?: (ids: string[]) => void;
  followUpGutter?: { onClickAction: (entityId: string, offset: "1week" | "1month") => Promise<void> | void };
  defaultOpen?: boolean;
  reloadSignal?: number;
  /** Pre-fetched content from the server — seeds the editor and the count
   *  synchronously on first render, avoiding a client-side fetch flash. */
  initialContent?: string;
  initialUpdatedAt?: string;
};

export function CollapsibleDashboard({
  title,
  module,
  entityLookup = [],
  compact = false,
  titleRight,
  onCountChange,
  showFlagged = false,
  onMatchedIdsChange,
  followUpGutter,
  defaultOpen = false,
  reloadSignal,
  initialContent,
  initialUpdatedAt,
}: CollapsibleDashboardProps) {
  // Seed count + matched IDs synchronously when initialContent is available
  const initialCount =
    initialContent !== undefined
      ? countEntityMatches(initialContent, entityLookup)
      : null;
  const initialMatchedIds =
    initialContent !== undefined
      ? getEntityMatchIds(initialContent, entityLookup)
      : null;
  const [count, setCount] = useState<number | null>(initialCount);
  // Seeded from the saved HTML so the badge is correct on first paint, then
  // kept live by the editor's own block scan.
  const initialFlagged =
    showFlagged && initialContent !== undefined
      ? getFlagBreakdown(initialContent, entityLookup)
      : null;
  const [flagged, setFlagged] = useState<FlagBreakdown | null>(initialFlagged);
  const [, startTransition] = useTransition();
  const suffix = count !== null && count > 0 ? ` (${count})` : "";

  // Fire seeded callbacks once so parent totals + reconcile state are
  // correct on first paint. Subsequent updates flow through the live
  // editor handlers below.
  useEffect(() => {
    if (initialCount !== null) onCountChange?.(initialCount);
    if (initialMatchedIds !== null) onMatchedIdsChange?.(initialMatchedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch count when reloadSignal bumps (so the title count stays accurate
  // after an external mutation, even if the editor is collapsed). Skip the
  // initial run when we already have seeded content from the server.
  useEffect(() => {
    if (reloadSignal === undefined) return;
    if (reloadSignal === 0 && initialContent !== undefined) return;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        const c = countEntityMatches(result.data.content, entityLookup);
        const ids = getEntityMatchIds(result.data.content, entityLookup);
        setCount(c);
        onCountChange?.(c);
        onMatchedIdsChange?.(ids);
        // Collapsible does not mount its children while closed, so a collapsed
        // board never gets a live editor scan. This refetch is the only thing
        // keeping its badge honest after an external mutation.
        if (showFlagged) setFlagged(getFlagBreakdown(result.data.content, entityLookup));
      } else {
        setCount(0);
        onCountChange?.(0);
        onMatchedIdsChange?.([]);
        if (showFlagged) setFlagged({ total: 0, byEmoji: [], roundWorthy: 0 });
      }
    });
  }, [module, entityLookup, onCountChange, onMatchedIdsChange, reloadSignal, initialContent, showFlagged]);

  const handleMatchCount = (c: number) => {
    setCount(c);
    onCountChange?.(c);
  };

  const flaggedBadge = showFlagged ? <FlaggedBadge breakdown={flagged} /> : undefined;

  return (
    <Collapsible title={title} titleSuffix={suffix} titleBadge={flaggedBadge} compact={compact} titleRight={titleRight} defaultOpen={defaultOpen}>
      <DashboardNotes
        module={module}
        entityLookup={entityLookup}
        compact={compact}
        onMatchCount={handleMatchCount}
        onMatchedIds={onMatchedIdsChange}
        onFlagBreakdown={showFlagged ? setFlagged : undefined}
        followUpGutter={followUpGutter}
        reloadSignal={reloadSignal}
        initialContent={initialContent}
        initialUpdatedAt={initialUpdatedAt}
      />
    </Collapsible>
  );
}
