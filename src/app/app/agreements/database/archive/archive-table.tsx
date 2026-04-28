"use client";

import { useState, useTransition } from "react";
import {
  unarchiveGeneratedAgreement,
  deleteGeneratedAgreement,
  getAgreementDownloadUrl,
} from "@/actions/agreements";
import type { GeneratedAgreement } from "@/lib/types";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17v-10m0 0l-4 4m4-4l4 4M4 3h12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11M9 9v5M11 9v5" />
    </svg>
  );
}

export function ArchivedAgreementsTable({
  initial,
}: {
  initial: GeneratedAgreement[];
}) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-8 text-center">
        No archived agreements.
      </div>
    );
  }

  async function onDownload(id: string) {
    const res = await getAgreementDownloadUrl(id);
    if (res.success) window.open(res.data, "_blank");
  }

  function onUnarchive(id: string) {
    startTransition(async () => {
      const res = await unarchiveGeneratedAgreement(id);
      if (res.success) setRows((r) => r.filter((x) => x.id !== id));
    });
  }

  function onDelete(id: string) {
    if (
      !confirm(
        "Permanently delete this agreement? The PDF will be removed and cannot be recovered."
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteGeneratedAgreement(id);
      if (res.success) setRows((r) => r.filter((x) => x.id !== id));
    });
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-dashed border-neutral-300 text-left text-xs text-neutral-500">
          <th className="py-2 font-medium">Filename</th>
          <th className="py-2 font-medium w-32">Type</th>
          <th className="py-2 font-medium w-48">Template</th>
          <th className="py-2 font-medium w-28">Created</th>
          <th className="py-2 font-medium w-28">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-neutral-100">
            <td className="py-2 max-w-0">
              <span className="block truncate" title={row.filename}>
                {row.filename}
              </span>
            </td>
            <td className="py-2 text-neutral-600">{row.agreement_type}</td>
            <td className="py-2 text-neutral-600">{row.template_name}</td>
            <td className="py-2 text-neutral-500 text-xs">
              {new Date(row.created_at).toLocaleDateString()}
            </td>
            <td className="py-2 flex items-center gap-1 w-28">
              <button
                type="button"
                onClick={() => onDownload(row.id)}
                title="Download"
                aria-label="Download"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <DownloadIcon />
              </button>
              <button
                type="button"
                onClick={() => onUnarchive(row.id)}
                title="Unarchive (restore)"
                aria-label="Unarchive"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <RestoreIcon />
              </button>
              <button
                type="button"
                onClick={() => onDelete(row.id)}
                title="Delete permanently"
                aria-label="Delete"
                className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-800"
              >
                <TrashIcon />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
