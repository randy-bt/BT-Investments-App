import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";

export default function DispositionsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Dispositions
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/dispositions
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            Investor search (placeholder)
          </p>
          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-3 text-xs text-neutral-500">
            [ Investor search input will live here ]
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            Dashboard notes (placeholder)
          </p>
          <div className="h-32 rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-3 text-xs text-neutral-500">
            [ Editable dashboard text area placeholder ]
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link
            href="/app/dispositions/investor-database"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Investor Database →
          </Link>
          <Link
            href="/app/dispositions/new-investor"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Add New Investor →
          </Link>
        </div>
      </section>
    </main>
  );
}

