import Link from "next/link";

export default function AgreementsLandingPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-3xl">
        <header className="w-full border-b border-dashed border-neutral-300 pb-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Agreements</h1>
          <p className="text-sm text-neutral-600">
            Generate and manage agreements
          </p>
        </header>

        <section className="grid w-full gap-4 sm:grid-cols-3">
          <MenuCard
            href="/app/agreements/create"
            title="Create New Agreement"
            description="Pick a template and generate a signed-ready PDF"
            variant="primary"
          />
          <MenuCard
            href="/app/agreements/database"
            title="Database"
            description="Browse previously generated agreements"
          />
          <MenuCard
            href="/app/agreements/admin"
            title="Manage Templates"
            description="Add or edit agreement templates"
          />
        </section>
      </div>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
  variant = "default",
}: {
  href: string;
  title: string;
  description: string;
  variant?: "default" | "primary";
}) {
  const base =
    "block rounded-lg border border-dashed p-5 shadow-sm transition hover:shadow-md";
  const styles =
    variant === "primary"
      ? "border-[#c5cca8] bg-[#e8edda] hover:bg-[#dce3cb] hover:border-[#b5bd94]"
      : "border-neutral-300 bg-white hover:border-neutral-400";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      <h2 className="text-sm font-medium text-neutral-800">{title}</h2>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </Link>
  );
}
