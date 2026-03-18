import Link from "next/link";

export default function FaqPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments – FAQ
          </h1>
          <p className="text-sm text-neutral-600">btinvestments.co/faq</p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-neutral-700">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/where-we-buy" className="hover:underline">
            Where We Buy
          </Link>
          <Link href="/faq" className="hover:underline">
            FAQ
          </Link>
          <Link href="/hello" className="hover:underline">
            Hello Portal
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 items-center">
        <div className="w-full rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/sell-property"
              className="rounded-md border border-neutral-400 px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Sell Your Property →
            </Link>
            <Link
              href="/join-buyers-list"
              className="rounded-md border border-neutral-400 px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Join Our Buyers List →
            </Link>
            <Link
              href="/"
              className="rounded-md border border-neutral-400 px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Home →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

