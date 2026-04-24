import Link from "next/link";
import {
  listAgreementTemplates,
  listLeadsForAgreement,
} from "@/actions/agreements";
import { CreateAgreementForm } from "./create-form";

export default async function CreateAgreementPage() {
  const [templatesRes, leadsRes] = await Promise.all([
    listAgreementTemplates(),
    listLeadsForAgreement(),
  ]);
  const templates = templatesRes.success ? templatesRes.data : [];
  const leads = leadsRes.success ? leadsRes.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Create New Agreement
          </h1>
          <p className="text-sm text-neutral-600">
            Pick a template, select a lead, review the form, and generate
          </p>
        </div>
        <Link
          href="/app/agreements"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          ← Back
        </Link>
      </header>

      {templates.length === 0 ? (
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500 shadow-sm">
          No templates yet.{" "}
          <Link
            href="/app/agreements/admin"
            className="text-neutral-800 underline"
          >
            Create one
          </Link>{" "}
          to get started.
        </section>
      ) : (
        <CreateAgreementForm templates={templates} leads={leads} />
      )}
    </main>
  );
}
