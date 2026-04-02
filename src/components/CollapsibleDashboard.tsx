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
};

export function CollapsibleDashboard({
  title,
  module,
  entityLookup = [],
  compact = false,
  titleRight,
}: CollapsibleDashboardProps) {
  const [count, setCount] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const suffix = count !== null && count > 0 ? ` (${count})` : "";

  // Fetch initial count on mount (works even when collapsed)
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        setCount(countEntityMatches(result.data.content, entityLookup));
      }
    });
  }, [module, entityLookup]);

  return (
    <Collapsible title={title} titleSuffix={suffix} compact={compact} titleRight={titleRight}>
      <DashboardNotes
        module={module}
        entityLookup={entityLookup}
        compact={compact}
        onMatchCount={setCount}
      />
    </Collapsible>
  );
}
