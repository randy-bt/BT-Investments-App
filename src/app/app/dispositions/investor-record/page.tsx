import { AppBackLink } from "@/components/AppBackLink";

export default function InvestorRecordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Investor Record
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/dispositions/investor-record
          </p>
        </div>
        <AppBackLink href="/app/dispositions/investor-database" />
      </header>

      <section className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-700">
              Investor profile
            </h2>
            <div className="space-y-2 text-xs text-neutral-600">
              <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
              <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
              <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-700">
              Buying criteria
            </h2>
            <div className="h-24 rounded-md border border-dashed border-neutral-300 bg-neutral-50" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-700">Notes</h2>
          <div className="h-24 rounded-md border border-dashed border-neutral-300 bg-neutral-50" />
        </div>
      </section>
    </main>
  );
}

