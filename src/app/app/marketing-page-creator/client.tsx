"use client";

import { useState, useTransition } from "react";
import { archiveListingPage, deleteListingPage } from "@/actions/listing-pages";
import type { ListingPage } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function publicUrl(page: ListingPage): string {
  return page.page_type === "webpage"
    ? `/deals/${page.slug}`
    : `/deals/html/${page.slug}`;
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

export function ActivePagesTable({
  initialPages,
}: {
  initialPages: ListingPage[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [isPending, startTransition] = useTransition();

  if (pages.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-4">No active pages yet.</p>
    );
  }

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

  return (
    <div className="divide-y divide-dashed divide-neutral-200">
      <div className="grid grid-cols-[1fr_100px_120px_100px] gap-4 px-3 py-2 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider">
        <span>Address</span>
        <span>Type</span>
        <span>Created</span>
        <span className="text-right">Actions</span>
      </div>

      {pages.map((page) => (
        <div
          key={page.id}
          className="grid grid-cols-[1fr_100px_120px_100px] gap-4 px-3 py-2.5 items-center"
        >
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
          <div className="flex justify-end items-center gap-1">
            <a
              href={publicUrl(page)}
              target="_blank"
              rel="noreferrer"
              title="Open page"
              aria-label="Open page"
              className="p-1.5 rounded text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <OpenIcon />
            </a>
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
  );
}
