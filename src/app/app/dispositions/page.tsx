import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { DashboardNotes } from "@/components/DashboardNotes";

export default function DispositionsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Dispositions
          </h1>
          <p className="text-sm text-neutral-600">
            Investor management dashboard
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">
            Press{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-xs">
              &#8984;K
            </kbd>{" "}
            to search investors by name, phone, email, or location.
          </p>
        </div>

        <DashboardNotes module="dispositions" />

        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link
            href="/app/dispositions/investor-database"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Investor Database &rarr;
          </Link>
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Add New Investor &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
