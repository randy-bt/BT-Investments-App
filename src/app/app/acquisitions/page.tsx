import Link from "next/link";
import { LeadsTable } from "@/components/LeadsTable";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { AcquisitionsDashboards } from "@/components/AcquisitionsDashboards";
import { getLeads } from "@/actions/leads";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";

export default async function AcquisitionsPage() {
  const [result, lookupResult, acqNote, aacqNote, fuNote] = await Promise.all([
    getLeads({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("acquisitions"),
    getDashboardNote("acquisitions_b"),
    getDashboardNote("follow_ups"),
  ]);
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  const initialNotes = {
    acquisitions: {
      content: acqNote.success ? acqNote.data.content : "",
      updatedAt: acqNote.success ? acqNote.data.updated_at : "",
    },
    acquisitions_b: {
      content: aacqNote.success ? aacqNote.data.content : "",
      updatedAt: aacqNote.success ? aacqNote.data.updated_at : "",
    },
    follow_ups: {
      content: fuNote.success ? fuNote.data.content : "",
      updatedAt: fuNote.success ? fuNote.data.updated_at : "",
    },
  };

  let unviewedIds: string[] = [];
  if (result.success) {
    const entities = result.data.items.map((l) => ({ id: l.id, created_by: l.created_by }));
    const unviewedResult = await getUnviewedEntityIdsExcludeCreator("lead", entities);
    if (unviewedResult.success) unviewedIds = unviewedResult.data;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Acquisitions
        </h1>
        <div className="flex items-center gap-3">
          <CallScriptViewer scriptType="acquisitions" />
          <Link
            href="/app/acquisitions/new-lead"
            className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
          >
            + Onboarding
          </Link>
        </div>
      </header>

      <AcquisitionsDashboards entityLookup={entityLookup} initialNotes={initialNotes} />

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <LeadsTable initialData={result.data} unviewedIds={unviewedIds} />
        ) : (
          <p className="text-sm text-red-600">Error loading leads</p>
        )}
      </section>
    </main>
  );
}
