import Link from "next/link";
import { getListingPages } from "@/actions/listing-pages";
import { ActivePagesTable } from "./client";

export const dynamic = "force-dynamic";

export default async function ListingPageCreatorPage() {
  const result = await getListingPages({ active: true });
  const pages = result.success ? result.data : [];

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-3xl py-10">
        <header className="w-full border-b border-dashed border-neutral-300 pb-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Listing Pages</h1>
          <p className="text-sm text-neutral-600">
            Generate property marketing pages
          </p>
        </header>

        <section className="grid w-full gap-4 sm:grid-cols-2">
          <MenuCard
            href="/app/marketing-page-creator/create"
            title="Create Listing Page"
            description="Fill in the property and generate a webpage or HTML"
            variant="primary"
          />
          <MenuCard
            href="/app/marketing-page-creator/archive"
            title="Archived Pages"
            description="Browse archived listing pages"
          />
        </section>

        <section className="w-full rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-3">
            Active Pages
          </h2>
          <ActivePagesTable initialPages={pages} />
        </section>
      </div>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
  variant = "default",
}: {
  href: string;
  title: string;
  description: string;
  variant?: "default" | "primary";
}) {
  const base =
    "block rounded-lg border border-dashed p-5 shadow-sm transition hover:shadow-md";
  const styles =
    variant === "primary"
      ? "border-[#c5cca8] bg-[#e8edda] hover:bg-[#dce3cb] hover:border-[#b5bd94]"
      : "border-neutral-300 bg-white hover:border-neutral-400";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      <h2 className="text-sm font-medium text-neutral-800">{title}</h2>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Link>
  );
}
