"use client";

import { useState, useCallback } from "react";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { InlineSearch } from "@/components/InlineSearch";
import { useAuth } from "@/components/AuthProvider";
import { triggerFollowUp } from "@/actions/follow-up";
import type { EntityLookup } from "@/actions/entity-lookup";

type Props = {
  entityLookup: EntityLookup[];
};

export function AcquisitionsDashboards({ entityLookup }: Props) {
  const { isAdmin } = useAuth();
  const [acqCount, setAcqCount] = useState(0);
  const [aacqCount, setAacqCount] = useState(0);
  const [fuCount, setFuCount] = useState(0);
  const [reloadSignal, setReloadSignal] = useState(0);

  const handleAcqCount = useCallback((c: number) => setAcqCount(c), []);
  const handleAacqCount = useCallback((c: number) => setAacqCount(c), []);
  const handleFuCount = useCallback((c: number) => setFuCount(c), []);

  const total = acqCount + aacqCount + fuCount;

  const followUpGutter = isAdmin
    ? {
        onClickAction: async (entityId: string, offset: "1week" | "1month") => {
          const r = await triggerFollowUp(entityId, offset);
          if (!r.success) {
            alert(`Follow-up failed: ${r.error}`);
            return;
          }
          if (!r.data.movedFromAcq) {
            alert(
              `Follow-up date set, but "${r.data.leadName}" wasn't found on the ACQ Dashboard text so nothing was moved.`
            );
          }
          setReloadSignal((n) => n + 1);
        },
      }
    : undefined;

  return (
    <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
      <CollapsibleDashboard
        title="ACQ Dashboard"
        module="acquisitions"
        entityLookup={entityLookup}
        titleRight={<div className="w-[30%]"><InlineSearch mode="leads" /></div>}
        onCountChange={handleAcqCount}
        followUpGutter={followUpGutter}
        reloadSignal={reloadSignal}
      />
      <div className="border-t border-dashed border-neutral-300 pt-4">
        <CollapsibleDashboard
          title="AACQ Dashboard"
          module="acquisitions_b"
          entityLookup={entityLookup}
          onCountChange={handleAacqCount}
          defaultOpen
          reloadSignal={reloadSignal}
        />
      </div>
      <div className="border-t border-dashed border-neutral-300 pt-4">
        <CollapsibleDashboard
          title="Follow-ups Dashboard"
          module="follow_ups"
          entityLookup={entityLookup}
          onCountChange={handleFuCount}
          reloadSignal={reloadSignal}
        />
      </div>
      <div className="border-t border-dashed border-neutral-300 pt-2 text-xs text-neutral-400">
        Total lead records: {total}
      </div>
    </section>
  );
}
