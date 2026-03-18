import Link from "next/link";

export default function HelloBtInvestmentsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          BT Investments Entry
        </h1>
        <p className="text-sm text-neutral-600">
          Choose how you&apos;d like to engage with BT Investments.
        </p>
      </header>

      <section className="space-y-4">
        <Link
          href="/join-buyers-list"
          className="flex items-center justify-between rounded-lg border border-dashed border-neutral-400 bg-white px-4 py-3 text-sm shadow-sm hover:bg-neutral-100"
        >
          <span>Join Our Buyers List</span>
          <span className="text-neutral-500">→</span>
        </Link>
        <Link
          href="/sell-property"
          className="flex items-center justify-between rounded-lg border border-dashed border-neutral-400 bg-white px-4 py-3 text-sm shadow-sm hover:bg-neutral-100"
        >
          <span>Sell Your Property</span>
          <span className="text-neutral-500">→</span>
        </Link>
        <Link
          href="/"
          className="flex items-center justify-between rounded-lg border border-dashed border-neutral-400 bg-white px-4 py-3 text-sm shadow-sm hover:bg-neutral-100"
        >
          <span>Enter Site</span>
          <span className="text-neutral-500">→</span>
        </Link>
      </section>

      <Link href="/hello" className="text-sm text-neutral-600 hover:underline">
        ← Back to /hello
      </Link>
    </main>
  );
}

