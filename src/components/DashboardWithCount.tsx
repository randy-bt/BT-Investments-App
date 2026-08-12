"use client";

import { useState, useEffect, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { countEntityMatches, getFlagBreakdown } from "@/lib/count-matches";
import type { FlagBreakdown } from "@/lib/flagged-lines";
import { FlaggedBadge } from "@/components/FlaggedBadge";
import type { EntityLookup } from "@/actions/entity-lookup";

type DashboardWithCountProps = {
  title: string;
  module: Parameters<typeof DashboardNotes>[0]["module"];
  entityLookup?: EntityLookup[];
  compact?: boolean;
  linkGutter?: boolean;
  statusGutter?: boolean;
  minHeight?: string;
  titleClassName?: string;
  titleRight?: React.ReactNode;
  leftStatus?: React.ReactNode;
  onCountChange?: (count: number) => void;
  /** Show the flagged-lead badge (Randy 8/10). Opt-in: this component also
   *  renders the Dispositions, Investor Database and JV boards. */
  showFlagged?: boolean;
  /** Pre-fetched content from the server — seeds the editor and the count
   *  synchronously on first render to avoid a client-fetch flash. */
  initialContent?: string;
  initialUpdatedAt?: string;
};

export function DashboardWithCount({
  title,
  module,
  entityLookup = [],
  compact = false,
  linkGutter = false,
  statusGutter = false,
  minHeight,
  titleClassName = "text-lg font-semibold tracking-tight",
  titleRight,
  leftStatus,
  onCountChange,
  showFlagged = false,
  initialContent,
  initialUpdatedAt,
}: DashboardWithCountProps) {
  const initialCount =
    initialContent !== undefined
      ? countEntityMatches(initialContent, entityLookup)
      : null;
  const [count, setCount] = useState<number | null>(initialCount);
  const initialFlagged =
    showFlagged && initialContent !== undefined
      ? getFlagBreakdown(initialContent, entityLookup)
      : null;
  const [flagged, setFlagged] = useState<FlagBreakdown | null>(initialFlagged);
  const [, startTransition] = useTransition();

  // Fire onCountChange once for the seeded count
  useEffect(() => {
    if (initialCount !== null) onCountChange?.(initialCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial count when no seeded content was supplied
  useEffect(() => {
    if (initialContent !== undefined) return;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        const c = countEntityMatches(result.data.content, entityLookup);
        setCount(c);
        onCountChange?.(c);
        if (showFlagged) setFlagged(getFlagBreakdown(result.data.content, entityLookup));
      } else {
        onCountChange?.(0);
      }
    });
  }, [module, entityLookup, onCountChange, initialContent, showFlagged]);

  const handleMatchCount = (c: number) => {
    setCount(c);
    onCountChange?.(c);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className={`${titleClassName} flex items-center`}>
          {title}{count !== null && count > 0 ? ` (${count})` : ""}
          {showFlagged && <FlaggedBadge breakdown={flagged} />}
        </h2>
        {titleRight}
      </div>
      <div className={compact ? "mt-2" : "mt-4"}>
        <DashboardNotes
          module={module}
          entityLookup={entityLookup}
          compact={compact}
          linkGutter={linkGutter}
          statusGutter={statusGutter}
          minHeight={minHeight}
          leftStatus={leftStatus}
          onMatchCount={handleMatchCount}
          onFlagBreakdown={showFlagged ? setFlagged : undefined}
          initialContent={initialContent}
          initialUpdatedAt={initialUpdatedAt}
        />
      </div>
    </div>
  );
}
