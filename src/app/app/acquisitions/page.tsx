import Link from "next/link";
import { DashboardNotes } from "@/components/DashboardNotes";
import { InlineSearch } from "@/components/InlineSearch";
import { LeadsTable } from "@/components/LeadsTable";
import { getLeads } from "@/actions/leads";

export default async function AcquisitionsPage() {
  const result = await getLeads({ page: 1, pageSize: 50, status: "active" });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Acquisitions
        </h1>
        <Link
          href="/app/acquisitions/new-lead"
          className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          + New Lead
        </Link>
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
          <div className="w-[30%]">
            <InlineSearch mode="leads" />
          </div>
        </div>
        <DashboardNotes module="acquisitions" />
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <LeadsTable initialData={result.data} />
        ) : (
          <p className="text-sm text-red-600">Error loading leads</p>
        )}
      </section>
    </main>
  );
}
