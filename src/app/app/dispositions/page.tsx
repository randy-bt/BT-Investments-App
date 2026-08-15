import Link from "next/link";
import { DashboardNotes } from "@/components/DashboardNotes";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { InlineSearch } from "@/components/InlineSearch";
import { InvestorsTable } from "@/components/InvestorsTable";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { getInvestors } from "@/actions/investors";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { getDispoQueue, reconcileDispoBoard } from "@/actions/dispo";
import { DspBoardCard } from "@/components/dispo/DspBoardCard";

export default async function DispositionsPage() {
  // Board self-heal BEFORE the content fetch (14.2 final form): the ⚡📤
  // lines and both fixed headers materialize on first load and a
  // hand-mangled board snaps back. Diff-gated and idempotent - a no-op
  // when the text already agrees - so this is a bounded sync, not the
  // read-that-mutates class of bug.
  await reconcileDispoBoard();
  const [result, lookupResult, marketingNote, dispNote, dbNote, jvNote] = await Promise.all([
    getInvestors({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("deals_marketing"),
    getDashboardNote("dispositions"),
    getDashboardNote("investor_database"),
    getDashboardNote("jv_partners"),
  ]);
  const queueResult = await getDispoQueue();
  const queueRows = queueResult.success ? queueResult.data : [];
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  const marketingSeed = {
    content: marketingNote.success ? marketingNote.data.content : "",
    updatedAt: marketingNote.success ? marketingNote.data.updated_at : "",
  };
  const dispSeed = {
    content: dispNote.success ? dispNote.data.content : "",
    updatedAt: dispNote.success ? dispNote.data.updated_at : "",
  };
  const dbSeed = {
    content: dbNote.success ? dbNote.data.content : "",
    updatedAt: dbNote.success ? dbNote.data.updated_at : "",
  };
  const jvSeed = {
    content: jvNote.success ? jvNote.data.content : "",
    updatedAt: jvNote.success ? jvNote.data.updated_at : "",
  };

  let unviewedIds: string[] = [];
  if (result.success) {
    const entities = result.data.items.map((i) => ({ id: i.id, created_by: i.created_by }));
    const unviewedResult = await getUnviewedEntityIdsExcludeCreator("investor", entities);
    if (unviewedResult.success) unviewedIds = unviewedResult.data;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Dispositions
        </h1>
        <div className="flex items-center gap-3">
          <CallScriptViewer scriptType="dispositions" />
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
          >
            + New Investor
          </Link>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Active Marketing</h2>
        <DashboardNotes
          module="deals_marketing"
          linkGutter
          minHeight="4.5rem"
          initialContent={marketingSeed.content}
          initialUpdatedAt={marketingSeed.updatedAt}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {/* ONE board, in text (Randy, 14.2 final form): ⚡📤 queue lines
            under READY TO SEND, Aldo's 💰🟢 lines under INVESTOR CALLS,
            all in the dashboard's own content. dispo_queue is the source
            of truth; the lines are its rendering, reconciled on every
            mutation and on load. Gutter buttons hang off the ⚡📤 marker
            (DspBoardCard wires them and hosts the dialogs). */}
        <DspBoardCard
          initialRows={queueRows}
          entityLookup={entityLookup}
          titleRight={<div className="w-[30%]"><InlineSearch mode="investors" /></div>}
          initialContent={dispSeed.content}
          initialUpdatedAt={dispSeed.updatedAt}
        />
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <InvestorsTable initialData={result.data} unviewedIds={unviewedIds} />
        ) : (
          <p className="text-sm text-red-600">Error loading investors</p>
        )}
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <CollapsibleDashboard
          title="Investor Database"
          module="investor_database"
          entityLookup={entityLookup}
          defaultOpen={false}
          initialContent={dbSeed.content}
          initialUpdatedAt={dbSeed.updatedAt}
        />
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <CollapsibleDashboard
          title="JV Partners"
          module="jv_partners"
          entityLookup={entityLookup}
          defaultOpen={false}
          initialContent={jvSeed.content}
          initialUpdatedAt={jvSeed.updatedAt}
        />
      </section>
    </main>
  );
}
