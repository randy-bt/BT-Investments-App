"use client";

import { useState } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { ExpandableCard } from "./expandable-card";
import type { EntityLookup } from "@/actions/entity-lookup";

export function OutreachDashboard({
  title,
  scriptType,
  module,
  quickModule,
  notesModule,
  entityLookup,
}: {
  title: string;
  scriptType: "agent_outreach" | "investor_outreach";
  module: "agent_outreach" | "investor_outreach";
  quickModule: "agent_outreach_quick" | "investor_outreach_quick";
  notesModule: "agent_outreach_notes" | "investor_outreach_notes";
  entityLookup: EntityLookup[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ExpandableCard
      onExpandChange={setExpanded}
      quickNotes={
        <DashboardNotes
          module={quickModule}
          entityLookup={entityLookup}
          minHeight="6rem"
        />
      }
      additionalNotes={
        <DashboardNotes
          module={notesModule}
          entityLookup={entityLookup}
        />
      }
    >
      <div className="mb-2 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-neutral-700">{title}</h2>
        <CallScriptViewer scriptType={scriptType} />
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <DashboardNotes
          module={module}
          entityLookup={entityLookup}
          statusGutter={expanded}
        />
      </div>
    </ExpandableCard>
  );
}
