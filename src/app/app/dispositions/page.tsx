import { Suspense } from "react";
import { Fraunces } from "next/font/google";
import { InvestorsTable } from "@/components/InvestorsTable";
import { getInvestors } from "@/actions/investors";
import { getUnviewedEntityIdsExcludeCreator } from "@/actions/entity-views";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { getDispoDeals } from "@/actions/dispo-deals";
import { reconcileDispoBoard } from "@/actions/dispo";
import { DispositionsClient } from "./client";
import { listOutreachRecordings } from "@/actions/outreach-recordings";
import { createServerClient } from "@/lib/supabase/server";
import type { ActiveListingPageWithLead } from "@/app/app/marketing-page-creator/types";

// Only this title changes font (brief §1). Loaded here rather than in the
// root layout so no other page pays for it.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], display: "swap" });

export default async function DispositionsPage() {
  // Board self-heal before the read, unchanged: the dashboard_notes text is
  // still what Geoffrey's Desk counts, so it has to stay accurate even now
  // that this page renders from getDispoDeals instead of the text.
  await reconcileDispoBoard();

  const [
    investorsResult, lookupResult, callsNote, dealsResult,
    ioNote, ioQuick, ioNotes, ioScratch, recordingsResult,
  ] = await Promise.all([
    getInvestors({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("dispositions_b"),
    getDispoDeals(),
    getDashboardNote("investor_outreach"),
    getDashboardNote("investor_outreach_quick"),
    getDashboardNote("investor_outreach_notes"),
    getDashboardNote("investor_outreach_scratch"),
    listOutreachRecordings(),
  ]);
  const seed = (n: typeof ioNote) => ({
    content: n.success ? n.data.content : "",
    updatedAt: n.success ? n.data.updated_at : "",
  });

  const entityLookup = lookupResult.success ? lookupResult.data : [];
  const deals = dealsResult.success ? dealsResult.data : { queued: [], active: [] };

  // The Marketing Page Database tab: the SAME query the creator's landing
  // page ran, so the table inside the tab is fed exactly what it was fed
  // before (Randy: "exactly like the old marketing page currently does").
  let activePages: ActiveListingPageWithLead[] = [];
  let archivedPages: ActiveListingPageWithLead[] = [];
  try {
    const supabase = await createServerClient();
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("listing_pages").select("*, leads(name)").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("listing_pages").select("*, leads(name)").eq("is_active", false).order("created_at", { ascending: false }),
    ]);
    activePages = (a ?? []) as ActiveListingPageWithLead[];
    archivedPages = (b ?? []) as ActiveListingPageWithLead[];
  } catch {
    /* an empty table beats a dead tab */
  }

  let unviewedIds: string[] = [];
  if (investorsResult.success) {
    const entities = investorsResult.data.items.map((i) => ({ id: i.id, created_by: i.created_by }));
    const r = await getUnviewedEntityIdsExcludeCreator("investor", entities);
    if (r.success) unviewedIds = r.data;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-10">
      {/* No dashed rule, no Call script, no + New Investor (brief §1).
          + New Investor now lives only on the Investors Database tab. */}
      {/* The header's right-hand button depends on the tab (Randy, Oct 2):
          Deals Index on Deals, + Create marketing page on Pages, + New
          Investor on Investors. The client owns the tab, so it owns the
          button; the title is all that is fixed here. */}

      {!dealsResult.success && (
        <p className="text-sm text-red-600">Error loading deals: {dealsResult.error}</p>
      )}

      <Suspense fallback={<p className="text-sm text-neutral-400">Loading…</p>}>
        <DispositionsClient
          title={<h1 className={`${fraunces.className} text-[38px] leading-none`}>Dispositions</h1>}
          queued={deals.queued}
          active={deals.active}
          activePages={activePages}
          archivedPages={archivedPages}
          callsContent={callsNote.success ? callsNote.data.content : ""}
          callsUpdatedAt={callsNote.success ? callsNote.data.updated_at : ""}
          entityLookup={entityLookup}
          investorOutreachNotes={{
            investor_outreach: seed(ioNote),
            investor_outreach_quick: seed(ioQuick),
            investor_outreach_notes: seed(ioNotes),
            investor_outreach_scratch: seed(ioScratch),
          }}
          investorRecordings={(recordingsResult.success ? recordingsResult.data : []).filter((r) => r.category === "investor")}
          investors={
            investorsResult.success
              ? (investorsResult.data as Parameters<typeof InvestorsTable>[0]["initialData"])
              : null
          }
          unviewedIds={unviewedIds}
        />
      </Suspense>
    </main>
  );
}
