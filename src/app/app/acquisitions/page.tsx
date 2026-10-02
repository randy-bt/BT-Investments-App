import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import { getLeads } from "@/actions/leads";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { listJvDeals } from "@/actions/jv-deals";
import { listOutreachRecordings } from "@/actions/outreach-recordings";
import { getAuthUser } from "@/lib/auth";
import { PARTNER_EMAILS } from "@/lib/team";
import { AcquisitionsClient } from "./client";

// Acquisitions, consolidated (Randy's go, Oct 2 2026): the Leads page, the
// JVs page and the Outreach page as three tabs in the Dispositions frame.
// "We're just moving pages around. Don't rebuild anything." This file only
// fetches what each of the three old pages fetched and hands it over.

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], display: "swap" });

export const dynamic = "force-dynamic";

const seed = (n: Awaited<ReturnType<typeof getDashboardNote>>) => ({
  content: n.success ? n.data.content : "",
  updatedAt: n.success ? n.data.updated_at : "",
});

export default async function AcquisitionsPage() {
  const user = await getAuthUser();
  // JVs tab: admin OR partner (Randy, Oct 2: Aldo can see it). The server
  // actions already accept partners via requireAdmin's PARTNER_EMAILS
  // clause; this is the page-level half of the same rule.
  const canSeeJvs = !!user && (user.role === "admin" || PARTNER_EMAILS.includes(user.email));

  const [
    leadsResult, lookupResult,
    acqNote, aacqNote, fuNote,
    jvResult,
    agentNote, agentQuick, agentNotes, agentScratch,
    recordingsResult,
  ] = await Promise.all([
    getLeads({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("acquisitions"),
    getDashboardNote("acquisitions_b"),
    getDashboardNote("follow_ups"),
    canSeeJvs ? listJvDeals() : Promise.resolve({ success: false as const, error: "not visible" }),
    getDashboardNote("agent_outreach"),
    getDashboardNote("agent_outreach_quick"),
    getDashboardNote("agent_outreach_notes"),
    getDashboardNote("agent_outreach_scratch"),
    listOutreachRecordings(),
  ]);

  const entityLookup = lookupResult.success ? lookupResult.data : [];

  let leadsUnviewedIds: string[] = [];
  if (leadsResult.success) {
    const entities = leadsResult.data.items.map((l) => ({ id: l.id, created_by: l.created_by }));
    const r = await getUnviewedEntityIdsExcludeCreator("lead", entities);
    if (r.success) leadsUnviewedIds = r.data;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      <Suspense fallback={<p className="text-sm text-neutral-400">Loading…</p>}>
        <AcquisitionsClient
          title={<h1 className={`${fraunces.className} text-[38px] leading-none`}>Acquisitions</h1>}
          canSeeJvs={canSeeJvs}
          entityLookup={entityLookup}
          leads={leadsResult.success ? leadsResult.data : null}
          leadsUnviewedIds={leadsUnviewedIds}
          acqNotes={{ acquisitions: seed(acqNote), acquisitions_b: seed(aacqNote), follow_ups: seed(fuNote) }}
          jvs={jvResult.success ? { active: jvResult.data.active, archived: jvResult.data.archived } : { error: jvResult.error }}
          outreachNotes={{
            agent_outreach: seed(agentNote),
            agent_outreach_quick: seed(agentQuick),
            agent_outreach_notes: seed(agentNotes),
            agent_outreach_scratch: seed(agentScratch),
          }}
          // Agent calls only; investor calls live on the Dispositions tab.
          recordings={(recordingsResult.success ? recordingsResult.data : []).filter((r) => r.category === "agent")}
        />
      </Suspense>
    </main>
  );
}
