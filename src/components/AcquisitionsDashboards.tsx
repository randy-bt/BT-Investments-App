"use client";

import { useState, useCallback } from "react";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { DashboardWithCount } from "@/components/DashboardWithCount";
import { InlineSearch } from "@/components/InlineSearch";
import type { EntityLookup } from "@/actions/entity-lookup";

type Props = {
  entityLookup: EntityLookup[];
};

export function AcquisitionsDashboards({ entityLookup }: Props) {
  const [acqCount, setAcqCount] = useState(0);
  const [aacqCount, setAacqCount] = useState(0);

  const handleAcqCount = useCallback((c: number) => setAcqCount(c), []);
  const handleAacqCount = useCallback((c: number) => setAacqCount(c), []);

  const total = acqCount + aacqCount;

  return (
    <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
      <CollapsibleDashboard
        title="ACQ Dashboard"
        module="acquisitions"
        entityLookup={entityLookup}
        titleRight={<div className="w-[30%]"><InlineSearch mode="leads" /></div>}
        onCountChange={handleAcqCount}
      />
      <div className="border-t border-dashed border-neutral-300 pt-4">
        <DashboardWithCount
          title="AACQ Dashboard"
          module="acquisitions_b"
          entityLookup={entityLookup}
          onCountChange={handleAacqCount}
          leftStatus={<span>Total lead records: {total}</span>}
        />
      </div>
    </section>
  );
}
