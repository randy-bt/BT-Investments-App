import { InlineSearch } from "@/components/InlineSearch";
import { CallRecorder } from "./call-recorder";
import { OutreachDashboardsClient } from "./outreach-dashboards-client";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { listOutreachRecordings } from "@/actions/outreach-recordings";
import { getDashboardNote } from "@/actions/dashboard-notes";

export default async function OutreachPage() {
  const [
    lookupResult,
    recordingsResult,
    acqOutreachNote,
    agentNote,
    agentQuickNote,
    agentNotesNote,
    investorNote,
    investorQuickNote,
    investorNotesNote,
  ] = await Promise.all([
    getAllEntityNames(),
    listOutreachRecordings(),
    getDashboardNote("acq_outreach"),
    getDashboardNote("agent_outreach"),
    getDashboardNote("agent_outreach_quick"),
    getDashboardNote("agent_outreach_notes"),
    getDashboardNote("investor_outreach"),
    getDashboardNote("investor_outreach_quick"),
    getDashboardNote("investor_outreach_notes"),
  ]);
  const entityLookup = lookupResult.success ? lookupResult.data : [];
  const recordings = recordingsResult.success ? recordingsResult.data : [];

  const seed = (n: typeof acqOutreachNote) => ({
    content: n.success ? n.data.content : "",
    updatedAt: n.success ? n.data.updated_at : "",
  });
  const initialNotes = {
    acq_outreach: seed(acqOutreachNote),
    agent_outreach: seed(agentNote),
    agent_outreach_quick: seed(agentQuickNote),
    agent_outreach_notes: seed(agentNotesNote),
    investor_outreach: seed(investorNote),
    investor_outreach_quick: seed(investorQuickNote),
    investor_outreach_notes: seed(investorNotesNote),
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">Outreach</h1>
        <div className="w-[30%]">
          <InlineSearch mode="all" />
        </div>
      </header>

      <OutreachDashboardsClient entityLookup={entityLookup} initialNotes={initialNotes} />

      {/* Call Recordings — full width below dashboards */}
      <CallRecorder initialRecordings={recordings} leads={entityLookup} />
    </main>
  );
}
