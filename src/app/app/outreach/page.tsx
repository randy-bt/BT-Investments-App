import { InlineSearch } from "@/components/InlineSearch";
import { CallRecorder } from "./call-recorder";
import { OutreachDashboard } from "./outreach-dashboard";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { listOutreachRecordings } from "@/actions/outreach-recordings";

export default async function OutreachPage() {
  const [lookupResult, recordingsResult] = await Promise.all([
    getAllEntityNames(),
    listOutreachRecordings(),
  ]);
  const entityLookup = lookupResult.success ? lookupResult.data : [];
  const recordings = recordingsResult.success ? recordingsResult.data : [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">Outreach</h1>
        <div className="w-[30%]">
          <InlineSearch mode="all" />
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {/* Agent Outreach column */}
        <div className="flex flex-col gap-4">
          <OutreachDashboard
            title="Agent Outreach Dashboard"
            scriptType="agent_outreach"
            module="agent_outreach"
            quickModule="agent_outreach_quick"
            notesModule="agent_outreach_notes"
            entityLookup={entityLookup}
          />
        </div>

        {/* Investor Outreach column */}
        <div className="flex flex-col gap-4">
          <OutreachDashboard
            title="Investor Outreach Dashboard"
            scriptType="investor_outreach"
            module="investor_outreach"
            quickModule="investor_outreach_quick"
            notesModule="investor_outreach_notes"
            entityLookup={entityLookup}
          />
        </div>
      </section>

      {/* Call Recordings — full width below dashboards */}
      <CallRecorder initialRecordings={recordings} leads={entityLookup} />
    </main>
  );
}
