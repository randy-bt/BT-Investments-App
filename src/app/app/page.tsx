import Link from "next/link";

export default function AppHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App
          </h1>
          <p className="text-sm text-neutral-600">app.btinvestments.co</p>
        </div>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          &larr; Back to public site
        </Link>
      </header>

      <section className="grid gap-8 md:grid-cols-[2fr,1.5fr]">
        <div className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">
            Universal Search
          </h2>
          <p className="text-sm text-neutral-500">
            Press{" "}
            <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-xs">
              &#8984;K
            </kbd>{" "}
            to search leads, investors, and properties.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700">App Modules</h2>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Link
              href="/app/acquisitions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Acquisitions &rarr;
            </Link>
            <Link
              href="/app/dispositions"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Dispositions &rarr;
            </Link>
            <Link
              href="/app/settings"
              className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
            >
              Settings &rarr;
            </Link>
          </div>
          <p className="text-xs text-neutral-400 pt-2">
            SMS Marketing, Marketing Page Creator, Contract Creator, and Housing
            Market News modules are planned for future phases.
          </p>
        </div>
      </section>
    </main>
  );
}
