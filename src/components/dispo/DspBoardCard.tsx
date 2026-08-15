"use client";

// The DSP Dashboard as ONE board (14.2 final form): queue rows are ⚡📤
// TEXT inside the dashboard's own content, and this wrapper supplies what
// text cannot - the gutter actions and their dialogs. It hands
// DashboardWithCount the dispoGutter mapping (line -> queue row) and
// hosts the preview dialog and send wizard that the gutter buttons open.
//
// After a send or dismiss, the server reconcile has already rewritten the
// board text; bumping reloadSignal makes the editor refetch it, and
// router.refresh() updates the rest of the page.

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
  titleRight,
}: {
  initialRows: DispoQueueRow[];
  entityLookup: EntityLookup[];
  initialContent: string;
  initialUpdatedAt: string;
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
        title="DSP Dashboard"
        module="dispositions"
        entityLookup={entityLookup}
        titleRight={titleRight}
        initialContent={initialContent}
        initialUpdatedAt={initialUpdatedAt}
        reloadSignal={reload}
        dispoGutter={{
          rows: rows.map((r) => ({ id: r.id, deal_name: r.deal_name })),
          onPreview: (id) => setPreviewRow(byId(id)),
          onSend: (id) => setWizardRow(byId(id)),
        }}
      />
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
