"use client";

import type { JvDeal } from "@/lib/types";

interface JvDealCardProps {
  deal: JvDeal;
  onInterested?: (id: string) => void;
  onDidntSell?: (id: string) => void;
  onClear?: (id: string) => void;
  onFix?: (deal: JvDeal) => void;
  onRestore?: (id: string) => void;
  archived?: boolean;
  badges?: { wasInterested: boolean; wasDidntSell: boolean };
  pending?: boolean;
}

function getBorderBg(deal: JvDeal, archived: boolean): string {
  if (archived) {
    return "border-l-4 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/60";
  }
  switch (deal.status) {
    case "interested":
      return "border-l-4 border-[#42501f] bg-[#ebeee0] dark:bg-[#2a2f1c]";
    case "didnt_sell":
      return "border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-950/40";
    default:
      // 'new' and 'cleared'
      return "border-l-4 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900";
  }
}

// '"Community Home Offers" <contact@x.com>' → 'Community Home Offers'
function senderDisplayName(source: string): string {
  const m = source.match(/^"?([^"<]+?)"?\s*</);
  return (m ? m[1] : source).trim();
}

export function JvDealCard({
  deal,
  onInterested,
  onDidntSell,
  onClear,
  onFix,
  onRestore,
  archived = false,
  badges,
  pending = false,
}: JvDealCardProps) {
  // The email's actual arrival date (created_at is ingest time, which is
  // wrong for backfilled deals). Manual adds fall back to created_at.
  const extra = deal.extra as {
    email_date?: string;
    subject?: string;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    lot_size?: string | null;
  } | null;
  const dealDate = new Date(extra?.email_date ?? deal.created_at);
  const bedsBaths =
    extra?.beds != null || extra?.baths != null
      ? `${extra?.beds ?? "?"}bd/${extra?.baths ?? "?"}ba`
      : null;

  const dateBlock = (
    <div className="w-12 shrink-0 text-center">
      <span className="block text-sm font-bold leading-tight text-neutral-800 dark:text-neutral-100">
        {dealDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
      <span className="block text-[10px] text-neutral-400 dark:text-neutral-500">
        {dealDate.getFullYear()}
      </span>
    </div>
  );

  const metaContent = (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {deal.address ?? extra?.subject ?? "(no address)"}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
        {deal.asking_price && (
          <span className="font-semibold text-green-700 dark:text-green-400">
            {deal.asking_price}
          </span>
        )}
        <span>
          Redfin{" "}
          {deal.redfin_price != null
            ? `$${deal.redfin_price.toLocaleString()}`
            : "—"}
        </span>
        {bedsBaths && <span>{bedsBaths}</span>}
        {extra?.sqft != null && <span>{extra.sqft.toLocaleString()} sqft</span>}
        {extra?.lot_size && <span>lot {extra.lot_size}</span>}
        {deal.needs_review && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            ⚠︎ review
          </span>
        )}
      </div>
      {deal.source_name && (
        <div className="mt-0.5 text-xs font-bold text-neutral-900 dark:text-white">
          {senderDisplayName(deal.source_name)}
        </div>
      )}
    </div>
  );

  // Compact icon button — opens the archived original email in a new tab.
  const emailButton =
    deal.source_channel === "email" ? (
      <a
        href={`/api/jv/email/${deal.id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the original email"
        className="rounded border border-neutral-300 px-1.5 py-0.5 text-[0.6rem] font-medium text-neutral-500 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        ✉
      </a>
    ) : deal.source_url ? (
      <a
        href={deal.source_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open source"
        className="rounded border border-neutral-300 px-1.5 py-0.5 text-[0.6rem] font-medium text-neutral-500 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        ↗
      </a>
    ) : null;

  // Right block: action buttons or archived badges + restore
  const rightBlock = archived ? (
    <div className="flex shrink-0 items-center gap-1.5">
      {emailButton}
      {badges?.wasInterested && (
        <span className="rounded-full border border-[#42501f] bg-[#ebeee0] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#42501f] dark:bg-[#2a2f1c] dark:text-[#c5cca8]">
          was Interested
        </span>
      )}
      {badges?.wasDidntSell && (
        <span className="rounded-full border border-orange-400 bg-orange-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
          was Didn&apos;t Sell
        </span>
      )}
      {onRestore && (
        <button
          type="button"
          onClick={() => onRestore(deal.id)}
          title="Restore this deal"
          disabled={pending}
          className="rounded border border-neutral-300 px-2 py-0.5 text-[0.6rem] font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Restore
        </button>
      )}
    </div>
  ) : (
    <div className="flex shrink-0 items-center gap-1.5">
      {emailButton}
      {onFix && (
        <button
          type="button"
          onClick={() => onFix(deal)}
          title={deal.needs_review ? "Fill in the missing info and clear the review flag" : "Edit deal details"}
          disabled={pending}
          className={
            deal.needs_review
              ? "rounded border border-amber-500 bg-amber-50 px-2 py-0.5 text-[0.6rem] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
              : "rounded border border-neutral-300 px-1.5 py-0.5 text-[0.6rem] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }
        >
          {deal.needs_review ? "Fix" : "✎"}
        </button>
      )}
      {onInterested && (
        <button
          type="button"
          onClick={() => onInterested(deal.id)}
          title={deal.status === "interested" ? "Un-mark Interested" : "Mark as Interested"}
          disabled={pending}
          className="rounded border border-[#42501f] px-2 py-0.5 text-[0.6rem] font-medium text-[#42501f] hover:bg-[#ebeee0] disabled:opacity-50 dark:border-[#c5cca8] dark:text-[#c5cca8] dark:hover:bg-[#2a2f1c]"
        >
          Interested
        </button>
      )}
      {onDidntSell && (
        <button
          type="button"
          onClick={() => onDidntSell(deal.id)}
          title={deal.status === "didnt_sell" ? "Un-mark Didn't Sell" : "Mark as Didn't Sell"}
          disabled={pending}
          className="rounded border border-orange-400 px-2 py-0.5 text-[0.6rem] font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 dark:text-orange-400 dark:hover:bg-orange-950/40"
        >
          Didn&apos;t Sell
        </button>
      )}
      {onClear && (
        <button
          type="button"
          onClick={() => onClear(deal.id)}
          title="Move to Archive (restorable; keeps dedupe history)"
          disabled={pending}
          className="rounded border border-neutral-300 px-2 py-0.5 text-[0.6rem] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Archive
        </button>
      )}
    </div>
  );

  return (
    <div className={`rounded-md px-3 py-2.5 ${getBorderBg(deal, archived)}`}>
      <div className="flex items-center justify-between gap-3">
        {dateBlock}
        {metaContent}
        {rightBlock}
      </div>
      {deal.note && (
        <p className="mt-1.5 border-t border-neutral-200 pt-1.5 text-xs whitespace-pre-wrap text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {deal.note}
        </p>
      )}
    </div>
  );
}
