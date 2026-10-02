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
import { SendWizard } from "@/components/dispo/DispoQueuePanel";
import { getDispoQueue, type DispoQueueRow } from "@/actions/dispo";
import type { DispoDeal } from "@/actions/dispo-deals";
import type { EntityLookup } from "@/actions/entity-lookup";

const TABS = [
  { key: "deals", label: "Deals" },
  { key: "pages", label: "Marketing Page Database" },
  { key: "investors", label: "Investors Database" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function DispositionsClient({
  queued,
  active,
  callsContent,
  callsUpdatedAt,
  entityLookup,
  investors,
  unviewedIds,
}: {
  queued: DispoDeal[];
  active: DispoDeal[];
  callsContent: string;
  callsUpdatedAt: string;
  entityLookup: EntityLookup[];
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
    (deal: DispoDeal) => {
      const row = rows.find((r) => r.id === deal.queueId);
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
              title="Investor Calls"
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
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Marketing Page Database</h2>
            <Link
              href="/app/marketing-page-creator"
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
            >
              + Create marketing page
            </Link>
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            The Marketing Page Creator moves into this tab next, working exactly as it does
            today. Until then it is still at its own address and the button above goes there.
          </p>
        </section>
      )}

      {tab === "investors" && (
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          {/* + New Investor lives ONLY here now (brief §6): it was removed
              from the page header, so this is its one home. The table owns
              its own heading, so the button sits in a row above it rather
              than being threaded through a prop it does not have. */}
          <div className="mb-3 flex items-center justify-end">
            <Link
              href="/app/dispositions/new-investor"
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
            >
              + New Investor
            </Link>
          </div>
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

      {wizardRow && (
        <SendWizard
          row={wizardRow}
          onClose={() => setWizardRow(null)}
          onSent={() => { setWizardRow(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
