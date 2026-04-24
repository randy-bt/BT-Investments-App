import Link from "next/link";
import { listGeneratedAgreements } from "@/actions/agreements";
import { ArchiveTable } from "./archive-table";

export default async function AgreementsArchivePage() {
  const res = await listGeneratedAgreements();
  const agreements = res.success ? res.data : [];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Agreements Database
          </h1>
          <p className="text-sm text-neutral-600">
            All generated agreements
          </p>
        </div>
        <Link
          href="/app/agreements"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          ← Back
        </Link>
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
        <ArchiveTable initial={agreements} />
      </section>
    </main>
  );
}
