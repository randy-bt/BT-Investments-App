import Link from "next/link";
import { DashboardNotes } from "@/components/DashboardNotes";
import { DashboardWithCount } from "@/components/DashboardWithCount";
import { InlineSearch } from "@/components/InlineSearch";
import { InvestorsTable } from "@/components/InvestorsTable";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { getInvestors } from "@/actions/investors";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";

export default async function DispositionsPage() {
  const [result, lookupResult] = await Promise.all([
    getInvestors({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
  ]);
  const entityLookup = lookupResult.success ? lookupResult.data : [];

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
            href="/app/dispositions/investor-database"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Investor Database
          </Link>
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
        <DashboardNotes module="deals_marketing" linkGutter minHeight="4.5rem" />
      </section>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <DashboardWithCount
          title="Dashboard"
          module="dispositions"
          entityLookup={entityLookup}
          titleRight={<div className="w-[30%]"><InlineSearch mode="investors" /></div>}
        />
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <InvestorsTable initialData={result.data} unviewedIds={unviewedIds} />
        ) : (
          <p className="text-sm text-red-600">Error loading investors</p>
        )}
      </section>
    </main>
  );
}
