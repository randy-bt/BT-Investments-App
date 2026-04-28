import { AppBackLink } from "@/components/AppBackLink";
import { listGeneratedAgreements } from "@/actions/agreements";
import { ArchivedAgreementsTable } from "./archive-table";

export const dynamic = "force-dynamic";

export default async function ArchivedAgreementsPage() {
  const result = await listGeneratedAgreements({ active: false });
  const rows = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Archived Agreements
          </h1>
          <p className="text-sm text-neutral-600">
            Restore or permanently delete previously archived agreements
          </p>
        </div>
        <AppBackLink href="/app/agreements/database" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
        <ArchivedAgreementsTable initial={rows} />
      </section>
    </main>
  );
}
