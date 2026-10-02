"use client";

// Acquisitions, three tabs (consolidation, Randy Oct 2 2026). Same frame as
// Dispositions: Fraunces title, underline tabs with the choice in the URL,
// a header whose right side follows the tab.
//
// RANDY'S RULE: "We're just moving pages around. Don't rebuild anything."
// Each tab renders the SAME component the old page rendered, fed the same
// data. The only changes are the ones he approved: Lead Records collapsible
// and collapsed, rounded JV pills, a Quick notes board beside each outreach
// list, and the call-script button gone.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AcquisitionsDashboards } from "@/components/AcquisitionsDashboards";
import { LeadsTable } from "@/components/LeadsTable";
import { InlineSearch } from "@/components/InlineSearch";
import { JvInboxClient } from "@/app/app/jvs/client";
import { OutreachDashboardsClient } from "@/app/app/outreach/outreach-dashboards-client";
import { CallRecorder } from "@/app/app/outreach/call-recorder";
import type { EntityLookup } from "@/actions/entity-lookup";

const TABS = [
  { key: "leads", label: "Leads" },
  { key: "jvs", label: "JVs" },
  { key: "outreach", label: "Agent Outreach" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const HEADER_BTN =
  "rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]";

type SeededNote = { content: string; updatedAt: string };

export function AcquisitionsClient({
  title,
  canSeeJvs,
  entityLookup,
  leads,
  leadsUnviewedIds,
  acqNotes,
  jvs,
  outreachNotes,
  recordings,
}: {
  title: React.ReactNode;
  /** Admin or partner. Everyone else sees no JVs tab at all. */
  canSeeJvs: boolean;
  entityLookup: EntityLookup[];
  leads: Parameters<typeof LeadsTable>[0]["initialData"] | null;
  leadsUnviewedIds: string[];
  acqNotes: Parameters<typeof AcquisitionsDashboards>[0]["initialNotes"];
  jvs: { active: Parameters<typeof JvInboxClient>[0]["initialActive"]; archived: Parameters<typeof JvInboxClient>[0]["initialArchived"] } | { error: string };
  outreachNotes: {
    agent_outreach: SeededNote; agent_outreach_quick: SeededNote; agent_outreach_notes: SeededNote;
    investor_outreach: SeededNote; investor_outreach_quick: SeededNote; investor_outreach_notes: SeededNote;
    agent_outreach_scratch?: SeededNote; investor_outreach_scratch?: SeededNote;
  };
  recordings: Parameters<typeof CallRecorder>[0]["initialRecordings"];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const visible = TABS.filter((t) => t.key !== "jvs" || canSeeJvs);
  const tab: TabKey = visible.some((t) => t.key === raw) ? (raw as TabKey) : "leads";

  const select = (key: TabKey) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("tab", key);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="dsp flex flex-col gap-5">
      <header className="flex items-center justify-between gap-4">
        {title}
        {tab === "leads" && (
          <div className="flex items-center gap-3">
            {/* The call-script button is gone (never used). */}
            <Link href="/app/acquisitions/new-lead" className={HEADER_BTN}>+ Onboarding</Link>
            <Link href="/app/acquisitions/bulk-onboard" className={HEADER_BTN}>+ Bulk Onboard</Link>
          </div>
        )}
        {tab === "outreach" && (
          <div className="w-[30%]"><InlineSearch mode="all" /></div>
        )}
      </header>

      <nav className="dsp-tabs" role="tablist">
        {visible.map((t) => (
          <button key={t.key} type="button" role="tab" onClick={() => select(t.key)} aria-selected={tab === t.key}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "leads" && (
        <>
          <AcquisitionsDashboards entityLookup={entityLookup} initialNotes={acqNotes} />
          <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
            {leads ? (
              <LeadsTable initialData={leads} unviewedIds={leadsUnviewedIds} collapsible />
            ) : (
              <p className="text-sm text-red-600">Error loading leads</p>
            )}
          </section>
        </>
      )}

      {tab === "jvs" && canSeeJvs && (
        // Today's JVs page, same centred max-w-3xl column, minus the page
        // h1 and subtitle the tab now supplies.
        <div className="mx-auto w-full max-w-3xl">
          {"error" in jvs ? (
            <p className="text-sm text-red-600 dark:text-red-400">Error loading JV deals: {jvs.error}</p>
          ) : (
            <JvInboxClient initialActive={jvs.active} initialArchived={jvs.archived} />
          )}
        </div>
      )}

      {tab === "outreach" && (
        <>
          <OutreachDashboardsClient entityLookup={entityLookup} initialNotes={outreachNotes} />
          <CallRecorder initialRecordings={recordings} leads={entityLookup} />
        </>
      )}
    </div>
  );
}
