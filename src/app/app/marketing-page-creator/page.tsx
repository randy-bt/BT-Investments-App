import { AppBackLink } from "@/components/AppBackLink";

export default function MarketingPageCreatorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Marketing Page Creator
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/marketing-page-creator
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500 shadow-sm">
        [ Placeholder module – future UI for building marketing pages. ]
      </section>
    </main>
  );
}

