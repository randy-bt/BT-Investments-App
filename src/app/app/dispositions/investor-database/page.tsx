import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";

export default function InvestorDatabasePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Investor Database
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/dispositions/investor-database
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ Investor table/list placeholder ]
        </div>
        <div className="flex justify-between text-sm">
          <Link
            href="/app/dispositions/investor-record"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            View example investor record →
          </Link>
          <Link
            href="/app/dispositions/new-investor"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            Add new investor →
          </Link>
        </div>
      </section>
    </main>
  );
}

