"use client";

// The scored JV intake on DSP2 (agent-requests #14.5), best score first.
// Randy thinks in the 0-10 number, so the ratio never appears. Badges ride
// as small chips; only OUT auto-clears (server-side), so everything shown
// here is a live candidate. Interested fires dispo trigger B and the deal
// lands in the ready-to-send queue.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setJvDealStatus } from "@/actions/jv-deals";
import type { ScoredJvDeal } from "@/actions/dispo";

const BADGE_STYLES: Record<string, string> = {
  DEV: "border-amber-400 text-amber-600",
  "VALUES DISAGREE": "border-orange-400 text-orange-600",
  "NEEDS INFO": "border-neutral-300 text-neutral-400",
  "NO AREA": "border-sky-400 text-sky-600",
};

export function JvIntakePanel({ initialDeals }: { initialDeals: ScoredJvDeal[] }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, status: "interested" | "cleared") {
    setBusy(id);
    const r = await setJvDealStatus(id, status);
    setBusy(null);
    if (r.success) {
      setDeals((prev) => prev.filter((d) => d.id !== id));
      router.refresh(); // an Interested lands in Ready to Send above
    }
  }

  if (deals.length === 0) {
    return <p className="text-sm text-neutral-400">No new JV deals waiting.</p>;
  }

  return (
    <div className="space-y-2">
      {deals.map((d) => (
        <div key={d.id} className="rounded-md border border-dashed border-neutral-200 px-3 py-2.5">
          <div className="flex items-center gap-3">
            {/* The score IS the interface (Randy's scale). Null = unscoreable. */}
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-base font-bold font-editable ${
                d.score == null
                  ? "border-neutral-200 text-neutral-300"
                  : d.score >= 7
                    ? "border-[#8a9a5b] bg-[#e8edda] text-[#46683F]"
                    : d.score >= 4
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-neutral-300 bg-neutral-50 text-neutral-500"
              }`}
            >
              {d.score ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{d.address ?? "No address yet"}</p>
              <p className="text-[13px] text-neutral-500">
                {d.asking_price ? `asking ${d.asking_price}` : "no price"}
                {d.badges
                  .filter((b) => b !== "OUT")
                  .map((b) => (
                    <span
                      key={b}
                      className={`ml-2 rounded border px-1 py-px text-[10px] font-semibold uppercase tracking-wide ${BADGE_STYLES[b] ?? "border-neutral-300 text-neutral-400"}`}
                    >
                      {b}
                    </span>
                  ))}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => act(d.id, "interested")}
                disabled={busy === d.id}
                className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-2.5 py-1 text-xs hover:bg-[#dce3cb] disabled:opacity-40"
              >
                Interested
              </button>
              <button
                onClick={() => act(d.id, "cleared")}
                disabled={busy === d.id}
                className="rounded-md border border-dashed border-neutral-300 px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-50 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
