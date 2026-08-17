import Link from "next/link";
import { Collapsible } from "@/components/Collapsible";
import { InlineSearch } from "@/components/InlineSearch";
import { InvestorsTable } from "@/components/InvestorsTable";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { getInvestors } from "@/actions/investors";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { DEAL_INDEX_PATH } from "@/lib/deal-url";
import { getDispoQueue, reconcileDispoBoard } from "@/actions/dispo";
import { DspBoardCard } from "@/components/dispo/DspBoardCard";

export default async function DispositionsPage() {
  // Board self-heal BEFORE the content fetch (14.2 final form): the ⚡📤
  // lines and both fixed headers materialize on first load and a
  // hand-mangled board snaps back. Diff-gated and idempotent - a no-op
  // when the text already agrees - so this is a bounded sync, not the
  // read-that-mutates class of bug.
  await reconcileDispoBoard();
  const [result, lookupResult, dispNote] = await Promise.all([
    getInvestors({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("dispositions"),
  ]);
  const queueResult = await getDispoQueue();
  const queueRows = queueResult.success ? queueResult.data : [];
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  const dispSeed = {
    content: dispNote.success ? dispNote.data.content : "",
    updatedAt: dispNote.success ? dispNote.data.updated_at : "",
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
          {/* Navigation, not a card (restructure 8/17): the old link to
              the deals index lived on the deleted Active Marketing board
              AND pointed at the pre-rotation route (dead for weeks -
              Aldo had no working path to the index from this page). */}
          <a
            href={`https://btinvestments.co${DEAL_INDEX_PATH}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Active Deals
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
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

      {/* Collapsed by default (restructure 8/17): the directory is here
          when needed and out of the way when not. The investor_database
          and jv_partners boards are gone - directories live in this
          table now, where nothing can drift; the JV Partners tab
          absorbed that board's names as typed records. */}
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <Collapsible title="Investor Records" defaultOpen={false}>
          {result.success ? (
            <InvestorsTable initialData={result.data} unviewedIds={unviewedIds} hideTitle />
          ) : (
            <p className="text-sm text-red-600">Error loading investors</p>
          )}
        </Collapsible>
      </section>
    </main>
  );
}
