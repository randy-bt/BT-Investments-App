import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { getFormSubmissions } from "@/actions/form-submissions";
import { formatDateTime } from "@/lib/format";

export default async function FormSubmissionsPage() {
  const result = await getFormSubmissions({ page: 1, pageSize: 100 });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Form Submissions
          </h1>
          <p className="text-sm text-neutral-600">
            All submissions from public-facing forms
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="px-3 py-2">Form</th>
                  <th className="px-3 py-2">Summary</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Email Sent</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((sub) => {
                  const data = sub.data as Record<string, unknown>;
                  const name =
                    data.name || data.full_name || data.first_name || "";
                  const summary = name
                    ? String(name)
                    : Object.values(data).find((v) => typeof v === "string" && v.length > 0)
                      ? String(Object.values(data).find((v) => typeof v === "string" && v.length > 0))
                      : "—";

                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
                    >
                      <td className="px-3 py-2">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600">
                          {sub.form_name}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`/app/form-submissions/${sub.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-800 hover:underline font-editable"
                        >
                          {summary}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-neutral-400">
                        {formatDateTime(sub.submitted_at)}
                      </td>
                      <td className="px-3 py-2">
                        {sub.notified ? (
                          <span className="text-green-600 text-xs">Yes</span>
                        ) : (
                          <span className="text-neutral-400 text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {result.data.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-neutral-400"
                    >
                      No form submissions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-red-600">Error loading submissions</p>
        )}
      </section>
    </main>
  );
}
