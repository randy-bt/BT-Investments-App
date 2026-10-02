"use client";

import { OutreachDashboard } from "./outreach-dashboard";
import type { EntityLookup } from "@/actions/entity-lookup";

type SeededNote = { content: string; updatedAt: string };

type Props = {
  entityLookup: EntityLookup[];
  initialNotes?: {
    agent_outreach: SeededNote;
    agent_outreach_quick: SeededNote;
    agent_outreach_notes: SeededNote;
    investor_outreach: SeededNote;
    investor_outreach_quick: SeededNote;
    investor_outreach_notes: SeededNote;
    agent_outreach_scratch?: SeededNote;
    investor_outreach_scratch?: SeededNote;
  };
};

// The ACQ Outreach Dashboard was removed from this page (Randy, Oct 2026:
// "that's serving no purpose"). Its data is untouched - the acq_outreach
// module still exists and moveBlockBetweenDashboards still works for the
// agent bridge - this page just no longer renders it, and nothing moves
// blocks into it any more.
export function OutreachDashboardsClient({ entityLookup, initialNotes }: Props) {
  return (
    <section className="flex flex-col gap-6">
      <OutreachDashboard
        title="Agent Outreach Dashboard"
        scriptType="agent_outreach"
        module="agent_outreach"
        quickModule="agent_outreach_quick"
        notesModule="agent_outreach_notes"
        entityLookup={entityLookup}
        // Agents are not leads or investors, so nothing on this board should
        // resolve to a record (Randy, Oct 2026). It was matching loosely and
        // putting a dot on an agent that linked to an investor named Andy.
        matchEntities={false}
        initialMain={initialNotes?.agent_outreach}
        initialQuick={initialNotes?.agent_outreach_quick}
        initialNotes={initialNotes?.agent_outreach_notes}
        scratchModule="agent_outreach_scratch"
        initialScratch={initialNotes?.agent_outreach_scratch}
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
        scratchModule="investor_outreach_scratch"
        initialScratch={initialNotes?.investor_outreach_scratch}
      />
    </section>
  );
}
