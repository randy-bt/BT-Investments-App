"use client";

import { useState, useEffect, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { Collapsible } from "@/components/Collapsible";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { countEntityMatches } from "@/lib/count-matches";
import type { EntityLookup } from "@/actions/entity-lookup";

type CollapsibleDashboardProps = {
  title: string;
  module: Parameters<typeof DashboardNotes>[0]["module"];
  entityLookup?: EntityLookup[];
  compact?: boolean;
  titleRight?: React.ReactNode;
  onCountChange?: (count: number) => void;
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
  followUpGutter,
  defaultOpen = false,
  reloadSignal,
  initialContent,
  initialUpdatedAt,
}: CollapsibleDashboardProps) {
  // Seed count synchronously when initialContent is available
  const initialCount =
    initialContent !== undefined
      ? countEntityMatches(initialContent, entityLookup)
      : null;
  const [count, setCount] = useState<number | null>(initialCount);
  const [, startTransition] = useTransition();
  const suffix = count !== null && count > 0 ? ` (${count})` : "";

  // Fire onCountChange once for the initial count so parent totals are correct
  useEffect(() => {
    if (initialCount !== null) onCountChange?.(initialCount);
    // We only fire once on mount for the seeded count; subsequent updates flow
    // through handleMatchCount or the reloadSignal effect below.
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
        setCount(c);
        onCountChange?.(c);
      } else {
        setCount(0);
        onCountChange?.(0);
      }
    });
  }, [module, entityLookup, onCountChange, reloadSignal, initialContent]);

  const handleMatchCount = (c: number) => {
    setCount(c);
    onCountChange?.(c);
  };

  return (
    <Collapsible title={title} titleSuffix={suffix} compact={compact} titleRight={titleRight} defaultOpen={defaultOpen}>
      <DashboardNotes
        module={module}
        entityLookup={entityLookup}
        compact={compact}
        onMatchCount={handleMatchCount}
        followUpGutter={followUpGutter}
        reloadSignal={reloadSignal}
        initialContent={initialContent}
        initialUpdatedAt={initialUpdatedAt}
      />
    </Collapsible>
  );
}
