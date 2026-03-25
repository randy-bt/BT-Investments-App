import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getLead } from "@/actions/leads";
import { getUpdates } from "@/actions/updates";
import { hasPhotoAttachments } from "@/actions/attachments";
import { markEntityViewed } from "@/actions/entity-views";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadRecordClient } from "./client";
import { CloseLeadButton } from "./close-button";

export default async function LeadRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadResult, updatesResult] = await Promise.all([
    getLead(id),
    getUpdates("lead", id),
    markEntityViewed("lead", id),
  ]);

  if (!leadResult.success) notFound();
  const lead = leadResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];

  // Check if any photo attachments exist for this lead
  const photosResult = await hasPhotoAttachments("lead", id);
  const hasPhotos = photosResult.success ? photosResult.data : false;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Lead Record
          </h1>
          {lead.status === "closed" && <StatusBadge status="closed" />}
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <LeadRecordClient lead={lead} updates={updates} hasPhotos={hasPhotos} />

      <div className="-mt-4 flex justify-start pb-4">
        <CloseLeadButton leadId={lead.id} status={lead.status} />
      </div>
    </main>
  );
}
