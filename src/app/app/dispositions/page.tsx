import Link from "next/link";
import { DashboardNotes } from "@/components/DashboardNotes";
import { InlineSearch } from "@/components/InlineSearch";
import { InvestorsTable } from "@/components/InvestorsTable";
import { getInvestors } from "@/actions/investors";

export default async function DispositionsPage() {
  const result = await getInvestors({ page: 1, pageSize: 50 });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Dispositions
          </h1>
          <p className="text-sm text-neutral-600">
            Investor management dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            + New Investor
          </Link>
          <Link
            href="/app/dispositions/investor-database"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Investor Database
          </Link>
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
        <InlineSearch mode="investors" />
        <DashboardNotes module="dispositions" />
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <InvestorsTable initialData={result.data} />
        ) : (
          <p className="text-sm text-red-600">Error loading investors</p>
        )}
      </section>
    </main>
  );
}
