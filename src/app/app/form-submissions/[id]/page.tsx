import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getFormSubmission } from "@/actions/form-submissions";
import { formatDateTime } from "@/lib/format";

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getFormSubmission(id);

  if (!result.success) notFound();
  const sub = result.data;
  const data = sub.data as Record<string, unknown>;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {sub.form_name}
          </h1>
          <p className="text-sm text-neutral-500">
            Submitted {formatDateTime(sub.submitted_at)}
          </p>
        </div>
        <AppBackLink href="/app/form-submissions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <dl className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-medium text-neutral-500">
                {formatLabel(key)}
              </dt>
              <dd className="mt-0.5 text-sm font-editable text-neutral-800 whitespace-pre-wrap">
                {value != null && String(value).length > 0
                  ? String(value)
                  : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="text-xs text-neutral-400">
        <p>Submission ID: {sub.id}</p>
        {sub.ip_address && <p>IP: {sub.ip_address}</p>}
        <p>Email notification: {sub.notified ? "Sent" : "Not sent"}</p>
      </div>
    </main>
  );
}
