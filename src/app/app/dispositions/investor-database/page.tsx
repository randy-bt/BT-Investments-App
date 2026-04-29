import { AppBackLink } from "@/components/AppBackLink";
import { DashboardNotes } from "@/components/DashboardNotes";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";

export default async function InvestorDatabasePage() {
  const [lookupResult, dbNote, jvNote] = await Promise.all([
    getAllEntityNames(),
    getDashboardNote("investor_database"),
    getDashboardNote("jv_partners"),
  ]);
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  const dbSeed = {
    content: dbNote.success ? dbNote.data.content : "",
    updatedAt: dbNote.success ? dbNote.data.updated_at : "",
  };
  const jvSeed = {
    content: jvNote.success ? jvNote.data.content : "",
    updatedAt: jvNote.success ? jvNote.data.updated_at : "",
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Investor Database
          </h1>
          <p className="text-sm text-neutral-600">
            Notes and resources for investor management
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Investor Database</h2>
        <DashboardNotes
          module="investor_database"
          entityLookup={entityLookup}
          initialContent={dbSeed.content}
          initialUpdatedAt={dbSeed.updatedAt}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">JV Partners</h2>
        <DashboardNotes
          module="jv_partners"
          entityLookup={entityLookup}
          initialContent={jvSeed.content}
          initialUpdatedAt={jvSeed.updatedAt}
        />
      </section>
    </main>
  );
}
