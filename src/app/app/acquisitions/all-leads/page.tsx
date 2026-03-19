import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { LeadsTable } from "@/components/LeadsTable";
import { getLeads } from "@/actions/leads";

export default async function AllLeadsPage() {
  const result = await getLeads({ page: 1, pageSize: 50 });

  if (!result.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
        <p className="text-sm text-red-600">
          Error loading leads: {result.error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Leads</h1>
          <p className="text-sm text-neutral-600">{result.data.total} leads</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/app/acquisitions/new-lead"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            + New Lead
          </Link>
          <AppBackLink href="/app/acquisitions" />
        </div>
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <LeadsTable initialData={result.data} />
      </section>
    </main>
  );
}
