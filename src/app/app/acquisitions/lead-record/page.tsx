import { AppBackLink } from "@/components/AppBackLink";

export default function LeadRecordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Lead Record
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/acquisitions/lead-record
          </p>
        </div>
        <AppBackLink href="/app/acquisitions/all-leads" />
      </header>

      <section className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            Property info
          </h2>
          <div className="space-y-2 text-xs text-neutral-600">
            <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
            <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
            <div className="h-6 rounded border border-dashed border-neutral-300 bg-neutral-50" />
          </div>
          <div className="space-y-2 pt-4">
            <h3 className="text-xs font-medium text-neutral-700">
              Notes / activity
            </h3>
            <div className="h-24 rounded-md border border-dashed border-neutral-300 bg-neutral-50" />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            Map / Street View
          </h2>
          <div className="h-48 rounded-md border border-dashed border-neutral-400 bg-neutral-50 text-center text-xs text-neutral-500 leading-[12rem]">
            [ Map / Street View placeholder ]
          </div>
        </div>
      </section>
    </main>
  );
}

