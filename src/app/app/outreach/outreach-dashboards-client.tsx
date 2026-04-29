"use client";

import { useCallback, useState } from "react";
import { OutreachDashboard } from "./outreach-dashboard";
import { AcqOutreachDashboard } from "./acq-outreach-dashboard";
import { moveBlockBetweenDashboards } from "@/actions/dashboard-notes";
import type { EntityLookup } from "@/actions/entity-lookup";

type SeededNote = { content: string; updatedAt: string };

type Props = {
  entityLookup: EntityLookup[];
  initialNotes?: {
    acq_outreach: SeededNote;
    agent_outreach: SeededNote;
    agent_outreach_quick: SeededNote;
    agent_outreach_notes: SeededNote;
    investor_outreach: SeededNote;
    investor_outreach_quick: SeededNote;
    investor_outreach_notes: SeededNote;
  };
};

export function OutreachDashboardsClient({ entityLookup, initialNotes }: Props) {
  const [agentReload, setAgentReload] = useState(0);
  const [acqReload, setAcqReload] = useState(0);

  const handleMoveFromAgent = useCallback(
    async ({ blockHtml, remainderHtml }: { blockHtml: string; remainderHtml: string }) => {
      const result = await moveBlockBetweenDashboards(
        "agent_outreach",
        "acq_outreach",
        blockHtml,
        remainderHtml
      );
      if (result.success) {
        setAgentReload((n) => n + 1);
        setAcqReload((n) => n + 1);
      }
    },
    []
  );

  return (
    <section className="flex flex-col gap-6">
      <AcqOutreachDashboard
        entityLookup={entityLookup}
        reloadSignal={acqReload}
        initialNote={initialNotes?.acq_outreach}
      />
      <OutreachDashboard
        title="Agent Outreach Dashboard"
        scriptType="agent_outreach"
        module="agent_outreach"
        quickModule="agent_outreach_quick"
        notesModule="agent_outreach_notes"
        entityLookup={entityLookup}
        onMoveBlock={handleMoveFromAgent}
        reloadSignal={agentReload}
        initialMain={initialNotes?.agent_outreach}
        initialQuick={initialNotes?.agent_outreach_quick}
        initialNotes={initialNotes?.agent_outreach_notes}
      />
      <OutreachDashboard
        title="Investor Outreach Dashboard"
        scriptType="investor_outreach"
        module="investor_outreach"
        quickModule="investor_outreach_quick"
        notesModule="investor_outreach_notes"
        entityLookup={entityLookup}
        initialMain={initialNotes?.investor_outreach}
        initialQuick={initialNotes?.investor_outreach_quick}
        initialNotes={initialNotes?.investor_outreach_notes}
      />
    </section>
  );
}
