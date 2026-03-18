import { AppBackLink } from "@/components/AppBackLink";

export default function NewInvestorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – New Investor
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/dispositions/new-investor
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ New investor form placeholder – sections for contact info, buying
          criteria, notes, etc. ]
        </div>
      </section>
    </main>
  );
}

