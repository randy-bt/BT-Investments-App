"use client";

import { useState, useTransition } from "react";
import { toggleListingPageActive } from "@/actions/listing-pages";
import type { ListingPage } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ListingPagesTable({
  initialPages,
}: {
  initialPages: ListingPage[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, currentValue: boolean) {
    startTransition(async () => {
      const result = await toggleListingPageActive(id, !currentValue);
      if (result.success) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, is_active: result.data.is_active } : p
          )
        );
      }
    });
  }

  async function handleCopy(html: string, id: string) {
    await navigator.clipboard.writeText(html);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (pages.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-4">
        No marketing pages created yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-dashed divide-neutral-200">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-3 py-2 text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider">
        <span>Address</span>
        <span>Price</span>
        <span>Created</span>
        <span className="text-right">Status</span>
      </div>

      {pages.map((page) => (
        <div key={page.id}>
          {/* Row */}
          <div
            className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-3 py-2.5 items-center cursor-pointer hover:bg-neutral-50 transition-colors"
            onClick={() =>
              setExpandedId(expandedId === page.id ? null : page.id)
            }
          >
            <span className="text-sm font-editable truncate">
              {page.address}
            </span>
            <span className="text-sm text-neutral-600">{page.price}</span>
            <span className="text-xs text-neutral-500">
              {formatDate(page.created_at)}
            </span>
            <div
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggle(page.id, page.is_active)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  page.is_active ? "bg-[#6e8439]" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    page.is_active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expanded HTML view */}
          {expandedId === page.id && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[0.65rem] text-neutral-400 uppercase tracking-wider">
                    HTML Output
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(page.html_content, page.id)}
                    className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-white transition-colors"
                  >
                    {copied === page.id ? "Copied!" : "Copy HTML"}
                  </button>
                </div>
                <pre className="text-xs text-neutral-600 font-editable whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                  {page.html_content}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
