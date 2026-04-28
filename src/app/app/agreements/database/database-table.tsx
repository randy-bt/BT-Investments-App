"use client";

import { useState, useTransition } from "react";
import {
  archiveGeneratedAgreement,
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

function ArchiveBoxIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14v3H3zM4 8v9h12V8M8 12h4" />
    </svg>
  );
}

export function DatabaseTable({ initial }: { initial: GeneratedAgreement[] }) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-8 text-center">
        No agreements generated yet.
      </div>
    );
  }

  async function onDownload(id: string) {
    const res = await getAgreementDownloadUrl(id);
    if (res.success) window.open(res.data, "_blank");
  }

  function onArchive(id: string) {
    startTransition(async () => {
      const res = await archiveGeneratedAgreement(id);
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
          <th className="py-2 font-medium w-20">Actions</th>
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
            <td className="py-2 flex items-center gap-1 w-20">
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
                onClick={() => onArchive(row.id)}
                title="Archive"
                aria-label="Archive"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <ArchiveBoxIcon />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
