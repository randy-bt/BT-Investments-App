import { DashboardNotes } from "@/components/DashboardNotes";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { InlineSearch } from "@/components/InlineSearch";
import { ExpandableCard } from "./expandable-card";
import { CallRecorder } from "./call-recorder";
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
          <ExpandableCard
            quickNotes={
              <DashboardNotes
                module="agent_outreach_quick"
                entityLookup={entityLookup}
                minHeight="6rem"
              />
            }
            additionalNotes={
              <DashboardNotes
                module="agent_outreach_notes"
                entityLookup={entityLookup}
              />
            }
          >
            <div className="mb-2 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-neutral-700">
                Agent Outreach Dashboard
              </h2>
              <CallScriptViewer scriptType="agent_outreach" />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <DashboardNotes
                module="agent_outreach"
                entityLookup={entityLookup}
                statusGutter
              />
            </div>
          </ExpandableCard>
        </div>

        {/* Investor Outreach column */}
        <div className="flex flex-col gap-4">
          <ExpandableCard
            quickNotes={
              <DashboardNotes
                module="investor_outreach_quick"
                entityLookup={entityLookup}
                minHeight="6rem"
              />
            }
            additionalNotes={
              <DashboardNotes
                module="investor_outreach_notes"
                entityLookup={entityLookup}
              />
            }
          >
            <div className="mb-2 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-neutral-700">
                Investor Outreach Dashboard
              </h2>
              <CallScriptViewer scriptType="investor_outreach" />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <DashboardNotes
                module="investor_outreach"
                entityLookup={entityLookup}
                statusGutter
              />
            </div>
          </ExpandableCard>
        </div>
      </section>

      {/* Call Recordings — full width below dashboards */}
      <CallRecorder initialRecordings={recordings} leads={entityLookup} />
    </main>
  );
}
