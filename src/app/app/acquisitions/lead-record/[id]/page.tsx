import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getLead } from "@/actions/leads";
import { getUpdates } from "@/actions/updates";
import { StageBadge } from "@/components/StageBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadRecordClient } from "./client";

export default async function LeadRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadResult, updatesResult] = await Promise.all([
    getLead(id),
    getUpdates("lead", id),
  ]);

  if (!leadResult.success) notFound();
  const lead = leadResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight font-editable">
            {lead.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <StageBadge stage={lead.stage} />
            <StatusBadge status={lead.status} />
          </div>
        </div>
        <AppBackLink href="/app/acquisitions/all-leads" />
      </header>

      <LeadRecordClient lead={lead} updates={updates} />
    </main>
  );
}
