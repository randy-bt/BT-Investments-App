"use client";

// Dispositions, three tabs (rebuild stage 2, Geoffrey brief Oct 2 2026).
//
// Tab lives in the URL so a link or bookmark opens the right one. Static
// tabs, never a scrollbar, wrapping on narrow screens.
//
// STAGE 2 SCOPE: the frame and a read-only Deals tab. Send (N) opens the
// EXISTING wizard untouched - rewiring the one path in the app that spends
// money is stage 3 and gets its own review. The Marketing Page Database tab
// still points at the live creator until stage 4 moves it in; a tab that
// half-works would be worse than one that says where the thing is.

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DealsTab } from "@/components/dispo/DealsTab";
import { DashboardWithCount } from "@/components/DashboardWithCount";
import { CallsInstructions } from "@/components/dispo/CallsInstructions";
import { InvestorsTable } from "@/components/InvestorsTable";
import { SendFlow } from "@/components/dispo/SendFlow";
import { getDispoQueue, enqueueListingDeal, type DispoQueueRow } from "@/actions/dispo";
import { ActivePagesTable } from "@/app/app/marketing-page-creator/client";
import type { ActiveListingPageWithLead } from "@/app/app/marketing-page-creator/types";
import { DEAL_INDEX_PATH } from "@/lib/deal-url";
import { InlineSearch } from "@/components/InlineSearch";
import { OutreachDashboardsClient } from "@/app/app/outreach/outreach-dashboards-client";
import { CallRecorder } from "@/app/app/outreach/call-recorder";
import type { OutreachRecording } from "@/actions/outreach-recordings";
import type { DispoDeal } from "@/actions/dispo-deals";
import type { EntityLookup } from "@/actions/entity-lookup";

// Order and labels per Randy (Oct 7 2026). The KEYS stay as they were so
// existing ?tab= links keep working.
const TABS = [
  { key: "deals", label: "Deals" },
  // Moved here from Acquisitions › Agent Outreach (Randy, Oct 2 2026).
  // Same modules, so the board text, its two Additional Notes boards and
  // its Quick notes board all come across untouched.
  { key: "investor-outreach", label: "Investor Outreach" },
  { key: "pages", label: "Marketing Pages" },
  { key: "investors", label: "Investors Database" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** One style for whichever action the header carries on the current tab
 *  (Randy, Oct 2: "make it the same color as the Deals Index button"). */
const HEADER_BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#5c6e2d] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4d5c26]";

export function DispositionsClient({
  title,
  queued,
  active,
  activePages,
  archivedPages,
  callsContent,
  callsUpdatedAt,
  entityLookup,
  investorOutreachNotes,
  investorRecordings,
  investors,
  unviewedIds,
}: {
  title: React.ReactNode;
  queued: DispoDeal[];
  active: DispoDeal[];
  activePages: ActiveListingPageWithLead[];
  archivedPages: ActiveListingPageWithLead[];
  callsContent: string;
  callsUpdatedAt: string;
  entityLookup: EntityLookup[];
  investorOutreachNotes: {
    investor_outreach: { content: string; updatedAt: string };
    investor_outreach_quick: { content: string; updatedAt: string };
    investor_outreach_notes: { content: string; updatedAt: string };
    investor_outreach_scratch: { content: string; updatedAt: string };
  };
  investorRecordings: OutreachRecording[];
  investors: Parameters<typeof InvestorsTable>[0]["initialData"] | null;
  unviewedIds: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "deals";

  const [wizardRow, setWizardRow] = useState<DispoQueueRow | null>(null);
  const [rows, setRows] = useState<DispoQueueRow[]>([]);
  useEffect(() => {
    getDispoQueue().then((r) => { if (r.success) setRows(r.data); });
  }, []);

  const handleSend = useCallback(
    async (deal: DispoDeal) => {
      let row = rows.find((r) => r.id === deal.queueId) ?? null;
      // A page on the index with no queue row yet (Alexander, Amit today):
      // compose and enqueue on open, as the brief says. This writes a
      // 'ready' row and composes the messages - it does not send.
      if (!row && deal.kind === "acq") {
        const q = await enqueueListingDeal(deal.id);
        if (q.success) {
          row = q.data;
          setRows((prev) => [...prev, q.data]);
        }
      }
      if (row) setWizardRow(row);
    },
    [rows],
  );

  const select = (key: TabKey) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("tab", key);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    // .dsp carries the mockup's variables for everything below it.
    <div className="dsp flex flex-col gap-5">
      <header className="flex items-center justify-between gap-4">
        {title}
        {tab === "deals" && (
          <a href={`https://btinvestments.co${DEAL_INDEX_PATH}`} target="_blank" rel="noopener noreferrer" className={HEADER_BTN}>
            Deals Index ↗
          </a>
        )}
        {tab === "pages" && (
          <Link href="/app/marketing-page-creator/create" className={HEADER_BTN}>+ Create marketing page</Link>
        )}
        {tab === "investors" && (
          <Link href="/app/dispositions/new-investor" className={HEADER_BTN}>+ New Investor</Link>
        )}
        {tab === "investor-outreach" && (
          <div className="w-[30%]"><InlineSearch mode="all" /></div>
        )}
      </header>

      {/* Underline tabs, per the approved mockup: inactive grey 14px/500,
          active ink 600 with a 2px olive underline, 1px line under the row.
          The first pass used filled pills; Randy compared the two. */}
      <nav className="dsp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            onClick={() => select(t.key)}
            aria-selected={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "deals" && (
        <>
          <DealsTab queued={queued} active={active} onSend={handleSend} />
          {/* Aldo's board, unchanged, in its own card below (brief §2). */}
          <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <DashboardWithCount
              // Randy, Oct 2: the card was "Active Dispositions Work"; renamed
              // "Dispositions Dashboard" Oct 9, 2026 (label only, module
              // unchanged). The pinned INVESTOR CALLS line inside the board is
              // content, not this title, and the Desk and the verdict reader
              // key off that board text.
              title="Dispositions Dashboard"
              module="dispositions_b"
              entityLookup={entityLookup}
              // The ⓘ replaces the "Aldo's follow-ups" caption (Randy, Oct 2):
              // Randy writes the instructions, everyone else reads them.
              titleRight={<CallsInstructions />}
              initialContent={callsContent}
              initialUpdatedAt={callsUpdatedAt}
            />
          </section>
        </>
      )}

      {tab === "pages" && (
        // The creator's landing table, moved in UNCHANGED (Randy: "exactly
        // like the old marketing page"). Create / edit / archive stay as
        // their own full-screen routes and open from the header button.
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Marketing Pages{" "}
            <span className="font-normal text-neutral-400">({activePages.length})</span>
          </h2>
          <ActivePagesTable initialPages={activePages} archivedPages={archivedPages} />
        </section>
      )}

      {tab === "investors" && (
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          {/* + New Investor lives ONLY here now (brief §6): it was removed
              from the page header, so this is its one home. The table owns
              its own heading, so the button sits in a row above it rather
              than being threaded through a prop it does not have. */}
          {investors ? (
            <InvestorsTable
              initialData={investors}
              unviewedIds={unviewedIds}
              title="Investors and JV Partners"
            />
          ) : (
            <p className="text-sm text-red-600">Error loading investors</p>
          )}
        </section>
      )}

      {tab === "investor-outreach" && (
        <>
          <OutreachDashboardsClient entityLookup={entityLookup} initialNotes={investorOutreachNotes} which="investor" />
          {/* Its OWN recordings: investor calls never mix with agent calls.
              Same table, separated by the category column that already
              existed; send-to-record targets investor records here. */}
          <CallRecorder initialRecordings={investorRecordings} leads={entityLookup} category="investor" />
        </>
      )}

      {wizardRow && (
        <SendFlow
          row={wizardRow}
          onClose={() => setWizardRow(null)}
          onSent={() => { setWizardRow(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
