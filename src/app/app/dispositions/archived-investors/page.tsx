import { AppBackLink } from "@/components/AppBackLink";
import { getInvestors } from "@/actions/investors";
import { ArchivedInvestorsTable } from "./client";

export default async function ArchivedInvestorsPage() {
  const result = await getInvestors({
    page: 1,
    pageSize: 100,
    status: "archived",
  });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Archived Investors
          </h1>
          <p className="text-sm text-neutral-600">
            Previously archived investor records
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <ArchivedInvestorsTable initialItems={result.data.items} />
        ) : (
          <p className="text-sm text-red-600">
            Error loading archived investors
          </p>
        )}
      </section>
    </main>
  );
}
