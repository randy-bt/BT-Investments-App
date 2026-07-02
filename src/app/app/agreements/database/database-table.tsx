"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  archiveGeneratedAgreement,
  getAgreementDownloadUrl,
  getAgreementViewUrl,
  renameGeneratedAgreement,
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

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3h4v4M9 11l8-8M15 11v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13l9-9 3 3-9 9H4v-3zM12 5l3 3" />
    </svg>
  );
}

// Pull a short "house# + city" label out of a generated filename.
// New format: "REVIEW FIRST - BT Investments - 12020 Bellevue - Dan Crisan - PSA V1.pdf"
// Old format: "BT Investments - 801 Des Moines WA - PSA - Sign.pdf"
// Falls back to the full filename when the pattern doesn't match — which is
// also what shows for any row whose filename has been manually edited.
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

export function DatabaseTable({ initial }: { initial: GeneratedAgreement[] }) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  // Which row is currently in inline-edit mode + the draft filename.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="text-sm text-neutral-500 py-8 text-center">
        No agreements generated yet.
      </div>
    );
  }

  async function onView(id: string) {
    const res = await getAgreementViewUrl(id);
    if (res.success) window.open(res.data, "_blank");
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

  function startEdit(row: GeneratedAgreement) {
    setEditingId(row.id);
    setDraftName(row.filename);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName("");
  }

  async function saveEdit(id: string) {
    const trimmed = draftName.trim();
    if (!trimmed) { cancelEdit(); return; }
    const original = rows.find((r) => r.id === id)?.filename;
    if (trimmed === original) { cancelEdit(); return; }
    setSavingId(id);
    const res = await renameGeneratedAgreement(id, trimmed);
    setSavingId(null);
    if (!res.success) { alert(`Rename failed: ${res.error}`); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, filename: trimmed } : x)));
    cancelEdit();
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
          <th className="py-2 font-medium w-32">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isEditing = editingId === row.id;
          return (
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
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => saveEdit(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit(row.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    disabled={savingId === row.id}
                    className="block w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-neutral-500 focus:outline-none disabled:opacity-50"
                  />
                ) : (
                  <span className="block truncate" title={row.filename}>
                    {shortLabel(row.filename)}
                  </span>
                )}
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
              <td className="py-2 flex items-center gap-1 w-32">
                <button
                  type="button"
                  onClick={() => onView(row.id)}
                  title="Open in new tab"
                  aria-label="Open in new tab"
                  className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <ExternalLinkIcon />
                </button>
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
                  onClick={() => (isEditing ? cancelEdit() : startEdit(row))}
                  title={isEditing ? "Cancel rename" : "Rename"}
                  aria-label={isEditing ? "Cancel rename" : "Rename"}
                  className={`p-1.5 rounded hover:bg-neutral-100 ${isEditing ? "text-cyan-600" : "text-neutral-700 hover:text-neutral-900"}`}
                >
                  <PencilIcon />
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
          );
        })}
      </tbody>
    </table>
  );
}
