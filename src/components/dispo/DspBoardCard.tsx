"use client";

// The dispositions boards, now TWO (Randy, Sept 2026), mirroring ACQ /
// AACQ on the acquisitions page:
//
//   DSP Deals           app-written only, read-only in the UI
//                       QUEUED FOR MARKETING + LIVE MARKETING
//   DSP Investor Calls  Aldo's, hand-edited, INVESTOR CALLS
//
// This wrapper supplies what board text cannot: the gutter actions and
// their dialogs. It hands DSP Deals the dispoGutter mapping (line -> queue
// row) and hosts the preview dialog and send wizard those buttons open.
// The gutters still work on a read-only board - they hang off the ⚡📤
// marker and act on dispo_queue, they are not text editing.
//
// After a send or dismiss, the server reconcile has already rewritten both
// boards; bumping reloadSignal makes each editor refetch, and
// router.refresh() updates the rest of the page. Aldo's board reloads too
// because a send is exactly when his 💰🟢 lines appear on it.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardWithCount } from "@/components/DashboardWithCount";
import { PreviewDialog, SendWizard } from "@/components/dispo/DispoQueuePanel";
import { getDispoQueue, type DispoQueueRow } from "@/actions/dispo";
import type { EntityLookup } from "@/actions/entity-lookup";

export function DspBoardCard({
  initialRows,
  entityLookup,
  initialContent,
  initialUpdatedAt,
  callsContent,
  callsUpdatedAt,
  titleRight,
}: {
  initialRows: DispoQueueRow[];
  entityLookup: EntityLookup[];
  initialContent: string;
  initialUpdatedAt: string;
  callsContent: string;
  callsUpdatedAt: string;
  titleRight?: React.ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DispoQueueRow[]>(initialRows);
  const [reload, setReload] = useState(0);
  const [previewRow, setPreviewRow] = useState<DispoQueueRow | null>(null);
  const [wizardRow, setWizardRow] = useState<DispoQueueRow | null>(null);

  const byId = useCallback((id: string) => rows.find((r) => r.id === id) ?? null, [rows]);

  const afterMutation = useCallback(async () => {
    const r = await getDispoQueue();
    if (r.success) setRows(r.data);
    setReload((n) => n + 1); // board text changed server-side; refetch it
    router.refresh();
  }, [router]);

  return (
    <>
      <DashboardWithCount
        title="DSP Deals"
        module="dispositions"
        entityLookup={entityLookup}
        titleRight={titleRight}
        initialContent={initialContent}
        initialUpdatedAt={initialUpdatedAt}
        reloadSignal={reload}
        readOnly
        dispoGutter={{
          rows: rows.map((r) => ({ id: r.id, deal_name: r.deal_name })),
          onPreview: (id) => setPreviewRow(byId(id)),
          onSend: (id) => setWizardRow(byId(id)),
        }}
      />
      {/* Aldo's board. Same dashed divider the AACQ board sits behind, so
          the two pages read the same way. Editable, and deliberately
          without a dispoGutter: the queue actions belong to DSP Deals. */}
      <div className="border-t border-dashed border-neutral-300 pt-4">
        <DashboardWithCount
          title="DSP Investor Calls"
          module="dispositions_b"
          entityLookup={entityLookup}
          initialContent={callsContent}
          initialUpdatedAt={callsUpdatedAt}
          reloadSignal={reload}
        />
      </div>
      {previewRow && <PreviewDialog row={previewRow} onClose={() => setPreviewRow(null)} />}
      {wizardRow && (
        <SendWizard
          row={wizardRow}
          onClose={() => setWizardRow(null)}
          onSent={() => {
            setWizardRow(null);
            afterMutation();
          }}
        />
      )}
    </>
  );
}
