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
}: CollapsibleDashboardProps) {
  const [count, setCount] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const suffix = count !== null && count > 0 ? ` (${count})` : "";

  // Fetch count on mount and whenever reloadSignal bumps (so the title count
  // stays accurate after an external mutation, even if the editor is collapsed).
  useEffect(() => {
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
  }, [module, entityLookup, onCountChange, reloadSignal]);

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
      />
    </Collapsible>
  );
}
