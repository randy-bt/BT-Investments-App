import { AppBackLink } from "@/components/AppBackLink";
import { DashboardNotes } from "@/components/DashboardNotes";

export default function InvestorDatabasePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Investor Database
          </h1>
          <p className="text-sm text-neutral-600">
            Notes and resources for investor management
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <DashboardNotes module="investor_database" />
      </section>
    </main>
  );
}
