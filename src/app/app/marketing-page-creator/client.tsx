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
      <div className="grid grid-cols-[1fr_100px_120px_140px] gap-4 px-3 py-2 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider">
        <span>Address</span>
        <span>Type</span>
        <span>Created</span>
        <span className="text-right">Actions</span>
      </div>

      {pages.map((page) => (
        <div
          key={page.id}
          className="grid grid-cols-[1fr_100px_120px_140px] gap-4 px-3 py-2.5 items-center"
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
          <div className="flex justify-end items-center gap-2">
            <a
              href={publicUrl(page)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-700 underline hover:text-neutral-900"
            >
              Open ↗
            </a>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleArchive(page.id)}
              className="text-xs text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDelete(page.id)}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
