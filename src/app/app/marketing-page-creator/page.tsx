import Link from "next/link";
import { getListingPages } from "@/actions/listing-pages";
import { ListingPagesTable } from "./client";

export default async function ListingPageCreatorPage() {
  const result = await getListingPages();
  const pages = result.success ? result.data : [];

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-4xl">
        <header className="flex w-full items-center justify-between border-b border-dashed border-neutral-300 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Listing Page Creator
            </h1>
            <p className="text-sm text-neutral-600">
              Generate one-page marketing flyers for properties
            </p>
          </div>
          <Link
            href="/app/marketing-page-creator/create"
            className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
          >
            + Create New Page
          </Link>
        </header>

        <section className="w-full rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
          <ListingPagesTable initialPages={pages} />
        </section>
      </div>
    </main>
  );
}
