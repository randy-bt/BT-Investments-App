"use client";

import { useState, useEffect, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { countEntityMatches } from "@/lib/count-matches";
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
}: DashboardWithCountProps) {
  const [count, setCount] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Fetch initial count on mount so it appears immediately
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        const c = countEntityMatches(result.data.content, entityLookup);
        setCount(c);
        onCountChange?.(c);
      } else {
        onCountChange?.(0);
      }
    });
  }, [module, entityLookup, onCountChange]);

  const handleMatchCount = (c: number) => {
    setCount(c);
    onCountChange?.(c);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className={titleClassName}>
          {title}{count !== null && count > 0 ? ` (${count})` : ""}
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
        />
      </div>
    </div>
  );
}
