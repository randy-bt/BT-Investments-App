"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchLocations, createLocation } from "@/actions/locations";
import { addInvestorLocation } from "@/actions/investors";
import type { Location } from "@/lib/types";
import type { UnmigratedInvestor } from "./page";

export function MigrateLocationsClient({ investors }: { investors: UnmigratedInvestor[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (investors.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700 p-4 text-sm text-green-900 dark:text-green-100">
        ✅ All investors migrated. Nothing left to do.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {investors.filter((i) => !hidden.has(i.id)).map((inv) => (
        <InvestorRow
          key={inv.id}
          investor={inv}
          onDone={() => {
            setHidden((s) => new Set(s).add(inv.id));
            router.refresh();
          }}
        />
      ))}
    </div>
  );
}

function InvestorRow({ investor, onDone }: { investor: UnmigratedInvestor; onDone: () => void }) {
  const [resolvedNames, setResolvedNames] = useState<Set<string>>(new Set());
  return (
    <div className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{investor.name}</div>
          {investor.company && <div className="text-xs text-neutral-500 dark:text-neutral-400">{investor.company}</div>}
        </div>
        <button
          onClick={onDone}
          className="rounded-md bg-[#5D3954] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a2d43]"
        >
          Mark as migrated
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {investor.unlinked_names.map((name) => (
          <NameResolver
            key={name}
            investorId={investor.id}
            name={name}
            resolved={resolvedNames.has(name)}
            onResolved={() => setResolvedNames((s) => new Set(s).add(name))}
          />
        ))}
      </div>
    </div>
  );
}

function NameResolver({
  investorId,
  name,
  resolved,
  onResolved,
}: {
  investorId: string;
  name: string;
  resolved: boolean;
  onResolved: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Location[] | null>(null);
  const [pending, startPending] = useTransition();

  async function load() {
    if (suggestions !== null) return;
    const r = await searchLocations(name);
    if (r.success) setSuggestions(r.data);
  }

  function handleAdd(locationId: string) {
    startPending(async () => {
      const r = await addInvestorLocation(investorId, locationId);
      if (r.success) onResolved();
      else alert(r.error);
    });
  }

  function handleCreate(kind: "city" | "county" | "region" | "state" | "neighborhood") {
    startPending(async () => {
      const created = await createLocation({ name, kind });
      if (!created.success) {
        alert(created.error);
        return;
      }
      const linked = await addInvestorLocation(investorId, created.data.id);
      if (linked.success) onResolved();
      else alert(linked.error);
    });
  }

  return (
    <div className={`rounded border border-neutral-200 dark:border-neutral-800 p-2.5 ${resolved ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-900 dark:text-neutral-100">
          {resolved && "✓ "}
          &ldquo;{name}&rdquo;
        </span>
        {!resolved && (
          <button
            onClick={load}
            disabled={pending}
            className="text-xs text-[#5D3954] dark:text-[#b890ac] hover:underline"
          >
            Find matches
          </button>
        )}
      </div>
      {suggestions !== null && !resolved && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.length === 0 && <span className="text-xs italic text-neutral-500 dark:text-neutral-400">No matches.</span>}
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleAdd(s.id)}
              disabled={pending}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              {s.name} <span className="opacity-50">({s.kind})</span>
            </button>
          ))}
          <span className="text-xs text-neutral-500 dark:text-neutral-400">or create as:</span>
          {(["city", "county", "region", "state", "neighborhood"] as const).map((k) => (
            <button
              key={k}
              onClick={() => handleCreate(k)}
              disabled={pending}
              className="rounded-md border border-dashed border-[#5D3954] px-2 py-1 text-xs text-[#5D3954] dark:text-[#b890ac] hover:bg-[#5D3954] hover:text-white"
            >
              + {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
