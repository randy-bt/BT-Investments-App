"use client";

import { useState, useTransition } from "react";
import { reopenInvestor } from "@/actions/investors";
import { formatDateTime } from "@/lib/format";
import type { Investor } from "@/lib/types";

export function ArchivedInvestorsTable({
  initialItems,
}: {
  initialItems: Investor[];
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  function handleUnarchive(id: string) {
    setUnarchivingId(id);
    startTransition(async () => {
      const result = await reopenInvestor(id);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
      setUnarchivingId(null);
    });
  }

  return (
    <div className="overflow-x-auto rounded border border-dashed border-neutral-300">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dashed border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Locations</th>
            <th className="px-3 py-2">Date Archived</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((investor) => (
            <tr
              key={investor.id}
              className="border-b border-dashed border-neutral-100 hover:bg-neutral-50"
            >
              <td className="px-3 py-2">
                <a
                  href={`/app/dispositions/investor-record/${investor.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-800 hover:underline font-editable"
                >
                  {investor.name}
                </a>
              </td>
              <td className="px-3 py-2 text-neutral-500 max-w-[200px] truncate">
                {investor.locations_of_interest}
              </td>
              <td className="px-3 py-2 text-neutral-400">
                {formatDateTime(investor.updated_at)}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleUnarchive(investor.id)}
                  disabled={isPending}
                  className="rounded border border-green-300 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  {unarchivingId === investor.id ? "Unarchiving..." : "Unarchive"}
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-8 text-center text-neutral-400"
              >
                No archived investors
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
