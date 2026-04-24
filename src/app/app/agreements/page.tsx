import Link from "next/link";

export default function AgreementsLandingPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Agreements</h1>
        <p className="text-sm text-neutral-600">
          Generate and manage agreements
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <MenuCard
          href="/app/agreements/create"
          title="Create New Agreement"
          description="Pick a template and generate a signed-ready PDF"
        />
        <MenuCard
          href="/app/agreements/archive"
          title="Database"
          description="Browse previously generated agreements"
        />
        <MenuCard
          href="/app/agreements/admin"
          title="Manage Templates"
          description="Add or edit agreement templates"
        />
      </section>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm transition hover:border-neutral-400 hover:shadow-md"
    >
      <h2 className="text-sm font-medium text-neutral-800">{title}</h2>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Link>
  );
}
