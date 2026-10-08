"use client";

// Controller for the Aldo update pop-up (v11 step 3), shared by the lead
// and investor record pages. Decides WHETHER to show it (Aldo's account,
// and the record has a line on one of his boards) and carries the attempt
// counts; the pop-up itself decides what to write.

import { useCallback, useEffect, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { boardWithLine } from "@/actions/dashboard-notes";
import { PARTNER_EMAILS, OWNER_EMAIL } from "@/lib/team";
import { attemptCounts, type Attempts, type PopupBoard, type PopupKind } from "@/lib/aldo-popup";
import type { ActivityFeedHandle } from "@/components/ActivityFeed";
import type { Update } from "@/lib/types";

export type OpenPopup = { board: PopupBoard; kind: PopupKind; attempts: Attempts | null };

type FeedRow = Update & { author_email?: string | null };

export function useAldoPopup(args: {
  entityName: string;
  /** Boards to check, in order of preference. */
  modules: PopupBoard[];
  feedRef: RefObject<ActivityFeedHandle | null>;
}) {
  const { user } = useAuth();
  // Preview for Randy (10/8): the pop-up stays Aldo-only, but on Randy's
  // account it also appears when the record URL carries ?popup=preview,
  // so he can see it without it living on his account.
  const searchParams = useSearchParams();
  const preview = user.email === OWNER_EMAIL && searchParams?.get("popup") === "preview";
  const isAldo = PARTNER_EMAILS.includes(user.email) || preview;
  const [board, setBoard] = useState<PopupBoard | null>(null);
  const [open, setOpen] = useState<OpenPopup | null>(null);
  const modulesKey = args.modules.join(",");

  useEffect(() => {
    if (!isAldo) return;
    let cancelled = false;
    boardWithLine(args.entityName, modulesKey.split(",") as PopupBoard[]).then((r) => {
      if (!cancelled && r.success) setBoard(r.data as PopupBoard | null);
    });
    return () => {
      cancelled = true;
    };
  }, [isAldo, args.entityName, modulesKey]);

  const show = useCallback(
    (kind: PopupKind, all: FeedRow[]) => {
      if (!isAldo || !board) return;
      const attempts = board === "acquisitions_b" ? attemptCounts(all, user.email) : null;
      setOpen({ board, kind, attempts });
    },
    [isAldo, board, user.email],
  );

  /** For ActivityFeed's onPosted. */
  const onPosted = useCallback((kind: "note" | "quick" | "summary", _update: Update, all: FeedRow[]) => show(kind, all), [show]);

  /** For the Quo and email dialogs' onSent: the row has just been pushed
   *  to the feed, so it is added to the list here for the attempt count. */
  const onSent = useCallback(
    (kind: "sms" | "email", update: Update) => {
      const current = args.feedRef.current?.getUpdates() ?? [];
      show(kind, [...current, { ...update, author_email: user.email }]);
    },
    [show, args.feedRef, user.email],
  );

  const close = useCallback(() => setOpen(null), []);

  return { open, onPosted, onSent, close, board, isAldo };
}
