import Link from "next/link";

export default function HelloPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">/hello</h1>
        <Link
          href="/app"
          className="rounded-md border border-neutral-400 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
        >
          app.btinvestments.co
        </Link>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Link
          href="/hello/bt-investments"
          className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-400 bg-white text-center text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
        >
          BT Investments
        </Link>
        <Link
          href="/signal/form"
          className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-400 bg-white text-center text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
        >
          Signal
        </Link>
        <Link
          href="/infinite-media/form"
          className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-400 bg-white text-center text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
        >
          Infinite Media
        </Link>
        <Link
          href="/infinite-re/form"
          className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-400 bg-white text-center text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100"
        >
          Infinite RE
        </Link>
      </section>

      {/* No explicit back link needed here; /hello is an entry portal. */}
    </main>
  );
}

