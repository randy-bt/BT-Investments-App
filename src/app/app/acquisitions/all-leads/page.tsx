import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";

export default function AllLeadsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – All Leads
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/acquisitions/all-leads
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ Leads table/list placeholder ]
        </div>
        <div className="flex justify-between text-sm">
          <Link
            href="/app/acquisitions/lead-record"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            View example lead record →
          </Link>
          <Link
            href="/app/acquisitions/new-lead"
            className="text-neutral-700 underline-offset-4 hover:underline"
          >
            Add new lead →
          </Link>
        </div>
      </section>
    </main>
  );
}

