import Link from "next/link";

export default function InfiniteMediaPortfolioPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Infinite Media – Portfolio
        </h1>
        <p className="text-sm text-neutral-600">
          Showcase of Infinite Media projects and work.
        </p>
      </header>

      <section className="space-y-4">
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ Infinite Media portfolio placeholder – content coming in a future phase ]
        </div>
      </section>

      <Link href="/infinite-media/form" className="text-sm text-neutral-600 hover:underline">
        &larr; Back to Infinite Media
      </Link>
    </main>
  );
}
