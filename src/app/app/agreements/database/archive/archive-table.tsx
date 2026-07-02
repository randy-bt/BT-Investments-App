"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

// Pull a short "house# + city" label out of a generated filename —
// handles both the "REVIEW FIRST - ..." and legacy formats; see
// database-table.tsx for the full rationale.
function shortLabel(filename: string): string {
  const parts = filename.split(" - ");
  if (parts.length < 3) return filename;
  const subject = (parts[0].trim() === "REVIEW FIRST" ? parts[2] : parts[1]).trim();
  return subject.replace(/\s+[A-Z]{2}\s*$/i, "").trim() || subject;
}

// Lead-record name minus the leading status emoji (🔷 etc.).
function cleanLeadName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/^[^\p{L}]+/u, "").trim() || name;
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
          <th className="py-2 font-medium w-6" />
          <th className="py-2 font-medium">Filename</th>
          <th className="py-2 font-medium w-40">Seller</th>
          <th className="py-2 font-medium w-10">V</th>
          <th className="py-2 font-medium w-32">Type</th>
          <th className="py-2 font-medium w-48">Template</th>
          <th className="py-2 font-medium w-28">Created</th>
          <th className="py-2 font-medium w-28">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-neutral-100">
            <td className="py-2 w-6 align-middle">
              {row.lead_id ? (
                <Link
                  href={`/app/acquisitions/lead-record/${row.lead_id}`}
                  title="Open lead record"
                  aria-label="Open lead record"
                  className="block h-2 w-2 rounded-full bg-cyan-500 hover:bg-cyan-400 transition-colors"
                />
              ) : (
                <span
                  title="No linked lead"
                  className="block h-2 w-2 rounded-full bg-neutral-300"
                />
              )}
            </td>
            <td className="py-2 max-w-0">
              <span className="block truncate" title={row.filename}>
                {shortLabel(row.filename)}
              </span>
            </td>
            <td className="py-2 text-neutral-700 dark:text-neutral-300">
              {row.lead_id && cleanLeadName(row.lead_name) ? (
                <Link
                  href={`/app/acquisitions/lead-record/${row.lead_id}`}
                  className="hover:underline"
                  title="Open lead record"
                >
                  {cleanLeadName(row.lead_name)}
                </Link>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
            </td>
            <td className="py-2">
              {row.version ? (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  V{row.version}
                </span>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
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
