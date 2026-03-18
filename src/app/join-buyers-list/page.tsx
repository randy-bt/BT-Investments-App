import Link from "next/link";

export default function JoinBuyersListPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Join Our Buyers List
          </h1>
          <p className="text-sm text-neutral-600">
            Funnel-style page with a future form for investors and buyers.
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-neutral-700">
          <Link href="/" className="text-neutral-600 hover:underline">
            ← Back
          </Link>
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/where-we-buy" className="hover:underline">
            Where We Buy
          </Link>
          <Link href="/faq" className="hover:underline">
            FAQ
          </Link>
        </nav>
      </header>

      <section className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-700">
          This will become a sign-up flow for your investor/buyer database.
          Right now it only reserves space for the future form. 📈
        </p>
        <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-6 text-sm text-neutral-500">
          [ Buyers list form placeholder – no inputs wired up in Phase 1 ]
        </div>
      </section>
    </main>
  );
}

