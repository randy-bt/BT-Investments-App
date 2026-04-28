"use client";

import { useState, useTransition } from "react";
import {
  unarchiveGeneratedAgreement,
  deleteGeneratedAgreement,
  getAgreementDownloadUrl,
} from "@/actions/agreements";
import type { GeneratedAgreement } from "@/lib/types";

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
          <th className="py-2 font-medium w-40">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-neutral-100">
            <td className="py-2">{row.filename}</td>
            <td className="py-2 text-neutral-600">{row.agreement_type}</td>
            <td className="py-2 text-neutral-600">{row.template_name}</td>
            <td className="py-2 text-neutral-500 text-xs">
              {new Date(row.created_at).toLocaleDateString()}
            </td>
            <td className="py-2 flex items-center gap-2 w-40">
              <button
                type="button"
                onClick={() => onDownload(row.id)}
                className="text-xs text-neutral-700 underline hover:text-neutral-900"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => onUnarchive(row.id)}
                className="text-xs text-neutral-700 hover:text-neutral-900"
              >
                Unarchive
              </button>
              <button
                type="button"
                onClick={() => onDelete(row.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
