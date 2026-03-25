"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { archiveLead, reopenLead, deleteLead } from "@/actions/leads";
import type { EntityStatus } from "@/lib/types";

export function CloseLeadButton({
  leadId,
  status,
}: {
  leadId: string;
  status: EntityStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isClosed = status === "closed";

  function handleConfirm() {
    startTransition(async () => {
      const result = isClosed
        ? await reopenLead(leadId)
        : await archiveLead(leadId);
      if (result.success) {
        setShowConfirm(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteLead(leadId);
      if (result.success) {
        setShowDeleteConfirm(false);
        router.push("/app/acquisitions");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className={`rounded-md px-3 py-1.5 text-sm ${
            isClosed
              ? "border border-green-300 text-green-700 hover:bg-green-50"
              : "bg-[#6b1c2a] text-white hover:bg-[#5a1724]"
          } disabled:opacity-50`}
        >
          {isClosed ? "Reopen Lead" : "Close Lead"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isPending}
          className="text-[0.65rem] text-neutral-400 hover:text-red-500 hover:underline disabled:opacity-50 ml-1"
        >
          Delete Lead
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-white px-8 py-6 shadow-lg max-w-md w-full mx-4 text-center">
            <p className="text-lg text-neutral-700">
              {isClosed
                ? "Are you sure you want to reopen this lead?"
                : "Are you sure you want to close this lead?"}
            </p>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded-md bg-neutral-800 px-5 py-2 text-base text-white hover:bg-neutral-700 mt-4"
            >
              Go Back
            </button>
            <br />
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="text-neutral-400 underline hover:text-neutral-600 disabled:opacity-50 mt-1.5 inline-block"
              style={{ fontSize: "0.7rem" }}
            >
              {isPending
                ? isClosed
                  ? "Reopening..."
                  : "Closing..."
                : isClosed
                  ? "Reopen Lead"
                  : "Close Lead"}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg bg-white px-8 py-6 shadow-lg max-w-md w-full mx-4 text-center">
            <p className="text-lg text-neutral-700">
              Are you sure you want to permanently delete this lead?
            </p>
            <p className="text-sm text-neutral-400 mt-1">
              This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md bg-neutral-800 px-5 py-2 text-base text-white hover:bg-neutral-700 mt-4"
            >
              Go Back
            </button>
            <br />
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-400 underline hover:text-red-600 disabled:opacity-50 mt-1.5 inline-block"
              style={{ fontSize: "0.7rem" }}
            >
              {isPending ? "Deleting..." : "Delete Lead"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
