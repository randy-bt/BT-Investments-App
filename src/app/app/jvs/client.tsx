"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JvDealCard } from "@/components/JvDealCard";
import {
  setJvDealStatus,
  restoreJvDeal,
  addManualJvDeal,
} from "@/actions/jv-deals";
import type { JvDeal } from "@/lib/types";

type ArchivedDeal = JvDeal & {
  badges: { wasInterested: boolean; wasDidntSell: boolean };
};

interface JvInboxClientProps {
  initialActive: JvDeal[];
  initialArchived: ArchivedDeal[];
}

export function JvInboxClient({
  initialActive,
  initialArchived,
}: JvInboxClientProps) {
  const router = useRouter();
  const [active, setActive] = useState<JvDeal[]>(initialActive);
  const [archived, setArchived] = useState<ArchivedDeal[]>(initialArchived);
  const [view, setView] = useState<"active" | "archive">("active");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual form state
  const [manualAddress, setManualAddress] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [manualAskingPrice, setManualAskingPrice] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualPending, setManualPending] = useState(false);

  function resetManualForm() {
    setManualAddress("");
    setManualSource("");
    setManualAskingPrice("");
    setManualNote("");
  }

  async function handleInterested(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await setJvDealStatus(id, "interested");
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActive((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "interested" as const } : d)),
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleDidntSell(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await setJvDealStatus(id, "didnt_sell");
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActive((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "didnt_sell" as const } : d)),
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleClear(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await setJvDealStatus(id, "cleared");
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Move from active to archived; refresh will bring real badge data
      const deal = active.find((d) => d.id === id);
      if (deal) {
        setActive((prev) => prev.filter((d) => d.id !== id));
        setArchived((prev) => [
          { ...deal, status: "cleared" as const, badges: { wasInterested: false, wasDidntSell: false } },
          ...prev,
        ]);
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleRestore(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await restoreJvDeal(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const deal = archived.find((d) => d.id === id);
      if (deal) {
        setArchived((prev) => prev.filter((d) => d.id !== id));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { badges: _badges, ...rest } = deal;
        setActive((prev) => [{ ...rest, status: "new" as const }, ...prev]);
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setManualPending(true);
    try {
      const result = await addManualJvDeal({
        address: manualAddress,
        source_name: manualSource,
        asking_price: manualAskingPrice || undefined,
        note: manualNote || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActive((prev) => [result.data, ...prev]);
      resetManualForm();
      setShowManual(false);
    } finally {
      setManualPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: view toggle + manual add */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-dashed border-neutral-300 p-0.5 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              view === "active"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Active ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setView("archive")}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              view === "archive"
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Archive ({archived.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowManual((prev) => !prev)}
          className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {showManual ? "Cancel" : "+ Manual Add"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Manual add form */}
      {showManual && (
        <form
          onSubmit={handleManualSubmit}
          className="flex flex-col gap-3 rounded-md border border-dashed border-neutral-300 bg-white px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Add JV Deal Manually
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="123 Main St, Seattle WA"
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Source <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manualSource}
                onChange={(e) => setManualSource(e.target.value)}
                placeholder="e.g. John Smith"
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Asking Price
              </label>
              <input
                type="text"
                value={manualAskingPrice}
                onChange={(e) => setManualAskingPrice(e.target.value)}
                placeholder="e.g. $350,000"
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Note
              </label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Optional note"
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={manualPending}
              className="rounded-md border border-[#42501f] bg-[#ebeee0] px-4 py-1.5 text-sm font-medium text-[#42501f] hover:bg-[#dce3cb] disabled:opacity-50 dark:border-[#c5cca8] dark:bg-[#2a2f1c] dark:text-[#c5cca8] dark:hover:bg-[#333d20]"
            >
              {manualPending ? "Adding…" : "Add Deal"}
            </button>
          </div>
        </form>
      )}

      {/* Deal list */}
      {view === "active" ? (
        <div className="flex flex-col gap-2">
          {active.length === 0 ? (
            <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              No JV deals yet.
            </p>
          ) : (
            active.map((deal) => (
              <JvDealCard
                key={deal.id}
                deal={deal}
                pending={pendingId === deal.id}
                onInterested={handleInterested}
                onDidntSell={handleDidntSell}
                onClear={handleClear}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {archived.length === 0 ? (
            <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Archive is empty.
            </p>
          ) : (
            archived.map((deal) => (
              <JvDealCard
                key={deal.id}
                deal={deal}
                archived
                badges={deal.badges}
                pending={pendingId === deal.id}
                onRestore={handleRestore}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
