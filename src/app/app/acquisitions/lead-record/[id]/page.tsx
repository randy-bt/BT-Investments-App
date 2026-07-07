import { notFound } from "next/navigation";
import { AppBackLink } from "@/components/AppBackLink";
import { getLead } from "@/actions/leads";
import { getUpdates } from "@/actions/updates";
import { hasPhotoAttachments } from "@/actions/attachments";
import { markEntityViewed } from "@/actions/entity-views";
import { getAuthUser } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadRecordClient } from "./client";
import { CloseLeadButton } from "./close-button";

export default async function LeadRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // pageSize lifted from the 50 default — leads with high call activity
  // were exceeding 50 updates, and since the feed orders oldest-first the
  // newest entries fell off the page (they only flashed via the optimistic
  // UI then vanished on refresh).
  const [leadResult, updatesResult, , authUser, photosResult] = await Promise.all([
    getLead(id),
    getUpdates("lead", id, { pageSize: 500 }),
    markEntityViewed("lead", id),
    getAuthUser(),
    hasPhotoAttachments("lead", id),
  ]);

  if (!leadResult.success) notFound();
  const lead = leadResult.data;
  const updates = updatesResult.success ? updatesResult.data.items : [];
  const currentUserName = authUser?.name ?? "User";

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

      <LeadRecordClient lead={lead} updates={updates} hasPhotos={hasPhotos} currentUserName={currentUserName} />

      <div className="-mt-4 flex justify-start pb-4">
        <CloseLeadButton leadId={lead.id} status={lead.status} />
      </div>
    </main>
  );
}
