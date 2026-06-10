"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { archiveListingPage, deleteListingPage, setListingPageIndexVisibility } from "@/actions/listing-pages";
import type { ActiveListingPageWithLead } from "./page";
import { ArchivedPagesTable } from "./archive/archive-table";
import type { ListingPage } from "@/lib/types";
import { dealUrl } from "@/lib/deal-url";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3h5v5M17 3l-8 8M9 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" />
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11M9 9v5M11 9v5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-1 9-9-3-3-9 9-1 4z M13 4l3 3" />
    </svg>
  );
}

export function ActivePagesTable({
  initialPages,
  archivedPages,
}: {
  initialPages: ActiveListingPageWithLead[];
  archivedPages: (ListingPage & { leads: { name: string } | null })[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [isPending, startTransition] = useTransition();
  const [archivedOpen, setArchivedOpen] = useState(false);

  function handleArchive(id: string) {
    startTransition(async () => {
      const r = await archiveListingPage(id);
      if (r.success) setPages((p) => p.filter((x) => x.id !== id));
    });
  }

  function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this listing page? This permanently removes the page and its photos."
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteListingPage(id);
      if (r.success) setPages((p) => p.filter((x) => x.id !== id));
    });
  }

  function handleToggleIndex(id: string, currentVisible: boolean) {
    setPages((p) =>
      p.map((x) => (x.id === id ? { ...x, show_on_index: !currentVisible } : x)),
    );
    startTransition(async () => {
      const r = await setListingPageIndexVisibility(id, !currentVisible);
      if (!r.success) {
        setPages((p) =>
          p.map((x) => (x.id === id ? { ...x, show_on_index: currentVisible } : x)),
        );
      }
    });
  }

  if (pages.length === 0) {
    return (
      <>
        <p className="text-sm text-neutral-400 py-4">No active pages yet.</p>
        <details
          open={archivedOpen}
          onToggle={(e) => setArchivedOpen((e.currentTarget as HTMLDetailsElement).open)}
          className="mt-2 rounded border border-dashed border-neutral-200"
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50">
            Archived Pages ({archivedPages.length})
          </summary>
          <div className="border-t border-dashed border-neutral-200">
            <ArchivedPagesTable initialPages={archivedPages} />
          </div>
        </details>
      </>
    );
  }

  return (
    <>
      <div className="divide-y divide-dashed divide-neutral-200">
        <div className="grid grid-cols-[120px_1fr_100px_120px_80px_120px] gap-4 px-3 py-2 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider">
          <span>Seller Name</span>
          <span>Address</span>
          <span>Type</span>
          <span>Created</span>
          <span className="text-center">On Index</span>
          <span className="text-right">Actions</span>
        </div>

        {pages.map((page) => (
          <div
            key={page.id}
            className="grid grid-cols-[120px_1fr_100px_120px_80px_120px] gap-4 px-3 py-2.5 items-center"
          >
            <span className="text-xs text-neutral-600 truncate">{page.leads?.name ?? '—'}</span>
            <span className="text-sm font-editable truncate">{page.address}</span>
            <span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                  page.page_type === "webpage"
                    ? "bg-[#e8edda] text-[#5c6e2d] border border-[#c5cca8]"
                    : "bg-neutral-100 text-neutral-700 border border-neutral-300"
                }`}
              >
                {page.page_type === "webpage" ? "Webpage" : "HTML"}
              </span>
            </span>
            <span className="text-xs text-neutral-500">
              {formatDate(page.created_at)}
            </span>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleToggleIndex(page.id, page.show_on_index)}
                disabled={isPending}
                aria-label={page.show_on_index ? "Hide from deals index" : "Show on deals index"}
                title={page.show_on_index ? "Visible on deals index — click to hide" : "Hidden from deals index — click to show"}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                  page.show_on_index ? "bg-[#5c6e2d]" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    page.show_on_index ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex justify-end items-center gap-1">
              <a
                href={dealUrl(page.slug, page.page_type)}
                target="_blank"
                rel="noreferrer"
                title="Open page"
                aria-label="Open page"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <OpenIcon />
              </a>
              <Link
                href={`/app/marketing-page-creator/edit/${page.id}`}
                title="Edit"
                aria-label="Edit"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <PencilIcon />
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleArchive(page.id)}
                title="Archive"
                aria-label="Archive"
                className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                <ArchiveBoxIcon />
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(page.id)}
                title="Delete permanently"
                aria-label="Delete"
                className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      <details
        open={archivedOpen}
        onToggle={(e) => setArchivedOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-6 rounded border border-dashed border-neutral-200"
      >
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50">
          Archived Pages ({archivedPages.length})
        </summary>
        <div className="border-t border-dashed border-neutral-200">
          <ArchivedPagesTable initialPages={archivedPages} />
        </div>
      </details>
    </>
  );
}
