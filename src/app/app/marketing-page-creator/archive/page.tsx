import { AppBackLink } from "@/components/AppBackLink";
import { getListingPages } from "@/actions/listing-pages";
import { ArchivedPagesTable } from "./archive-table";

export const dynamic = "force-dynamic";

export default async function ArchivedListingPages() {
  const result = await getListingPages({ active: false });
  const pages = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Archived Pages
          </h1>
          <p className="text-sm text-neutral-600">
            Restore or permanently delete previously archived listing pages
          </p>
        </div>
        <AppBackLink href="/app/marketing-page-creator" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
        <ArchivedPagesTable initialPages={pages} />
      </section>
    </main>
  );
}
