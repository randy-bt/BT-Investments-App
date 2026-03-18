import Link from "next/link";

export default function AppHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Home
          </h1>
          <p className="text-sm text-neutral-600">app.btinvestments.co</p>
        </div>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          ← Back to public site
        </Link>
      </header>

      <section className="grid gap-8 md:grid-cols-[2fr,1.5fr]">
        <div className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            Universal Search (placeholder)
          </h2>
          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
            [ Centered universal search bar placeholder – no real search in
            Phase 1 ]
          </div>
          <div className="space-y-2 text-sm text-neutral-700">
            <p className="font-medium">Market info / housing news</p>
            <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-4 text-xs text-neutral-500">
              [ Placeholder for housing market news widgets or feed ]
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            App Modules
          </h2>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Link
              href="/app/acquisitions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Acquisitions →
            </Link>
            <Link
              href="/app/dispositions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Dispositions →
            </Link>
            <Link
              href="/app/sms-marketing"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              SMS Marketing →
            </Link>
            <Link
              href="/app/marketing-page-creator"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Marketing Page Creator →
            </Link>
            <Link
              href="/app/contract-creator"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Contract Creator →
            </Link>
            <Link
              href="/app/housing-market-news"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Housing Market News →
            </Link>
            <Link
              href="/app/settings"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              App Settings →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

