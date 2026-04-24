import Link from "next/link";
import { listAgreementTemplates } from "@/actions/agreements";
import { AdminClient } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AgreementsAdminPage() {
  const res = await listAgreementTemplates({ includeInactive: true });
  const templates = res.success ? res.data : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Manage Agreement Templates
          </h1>
          <p className="text-sm text-neutral-600">
            Create, edit, or archive templates
          </p>
        </div>
        <Link
          href="/app/agreements"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          ← Back
        </Link>
      </header>

      <AdminClient initial={templates} />
    </main>
  );
}
