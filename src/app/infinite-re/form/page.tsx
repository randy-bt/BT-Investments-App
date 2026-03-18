import Link from "next/link";

export default function InfiniteReFormPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Infinite RE – Form Placeholder
        </h1>
        <p className="text-sm text-neutral-600">
          Future form for Infinite RE. Currently just a structural placeholder.
        </p>
      </header>

      <section className="space-y-4">
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ Infinite RE form placeholder – no real inputs wired up in Phase 1 ]
        </div>
      </section>

      <Link href="/hello" className="text-sm text-neutral-600 hover:underline">
        ← Back to /hello
      </Link>
    </main>
  );
}

