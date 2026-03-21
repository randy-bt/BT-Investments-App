import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";
import { getLeads } from "@/actions/leads";
import { formatDateTime } from "@/lib/format";

export default async function ClosedLeadsPage() {
  const result = await getLeads({ page: 1, pageSize: 100, status: "closed" });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Closed Leads
          </h1>
          <p className="text-sm text-neutral-600">
            Previously closed acquisition leads
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {result.success ? (
          <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Date Closed</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={`/app/acquisitions/lead-record/${lead.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-800 hover:underline font-editable"
                      >
                        {lead.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {lead.address || "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {lead.source_campaign_name || "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">
                      {formatDateTime(lead.updated_at)}
                    </td>
                  </tr>
                ))}
                {result.data.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-neutral-400"
                    >
                      No closed leads
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-red-600">Error loading closed leads</p>
        )}
      </section>
    </main>
  );
}
