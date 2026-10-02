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
import { DEAL_INDEX_PATH } from "@/lib/deal-url";

// Only this title changes font (brief §1). Loaded here rather than in the
// root layout so no other page pays for it.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], display: "swap" });

export default async function DispositionsPage() {
  // Board self-heal before the read, unchanged: the dashboard_notes text is
  // still what Geoffrey's Desk counts, so it has to stay accurate even now
  // that this page renders from getDispoDeals instead of the text.
  await reconcileDispoBoard();

  const [investorsResult, lookupResult, callsNote, dealsResult] = await Promise.all([
    getInvestors({ page: 1, pageSize: 50, status: "active" }),
    getAllEntityNames(),
    getDashboardNote("dispositions_b"),
    getDispoDeals(),
  ]);

  const entityLookup = lookupResult.success ? lookupResult.data : [];
  const deals = dealsResult.success ? dealsResult.data : { queued: [], active: [] };

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
      <header className="flex items-center justify-between gap-4">
        <h1 className={`${fraunces.className} text-[38px] leading-none`}>Dispositions</h1>
        {/* Moved up from the old DSP Deals card (brief §1). */}
        <a
          href={`https://btinvestments.co${DEAL_INDEX_PATH}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#5c6e2d] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4d5c26]"
        >
          Deals Index ↗
        </a>
      </header>

      {!dealsResult.success && (
        <p className="text-sm text-red-600">Error loading deals: {dealsResult.error}</p>
      )}

      <Suspense fallback={<p className="text-sm text-neutral-400">Loading…</p>}>
        <DispositionsClient
          queued={deals.queued}
          active={deals.active}
          callsContent={callsNote.success ? callsNote.data.content : ""}
          callsUpdatedAt={callsNote.success ? callsNote.data.updated_at : ""}
          entityLookup={entityLookup}
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
