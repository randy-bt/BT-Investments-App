import { AppBackLink } from "@/components/AppBackLink";
import { InvestorForm } from "@/components/InvestorForm";

export default function NewInvestorPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            New Investor
          </h1>
          <p className="text-sm text-neutral-600">
            Add a new investor to the database
          </p>
        </div>
        <AppBackLink href="/app/dispositions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <InvestorForm />
      </section>
    </main>
  );
}
