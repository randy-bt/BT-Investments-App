"use client";

// Live board signal (Randy 10/8, v11 step 1). Three ways an open board
// learns the database moved on, all funnelled into one callback that
// refetches through the server action:
//   1. Supabase Realtime UPDATE events on dashboard_notes for this module
//      (about a second after any write, from anyone).
//   2. A 30-second check, in case the Realtime socket silently dropped.
//   3. Tab focus or visibility change, so coming back shows the latest.
// The Realtime payload is never used as content; it is only the nudge.

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export const LIVE_POLL_MS = 30_000;

export function useBoardLive(module: string, onSignal: () => void, enabled = true) {
  const cb = useRef(onSignal);
  useEffect(() => {
    cb.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!enabled) return;
    const fire = () => cb.current();

    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`dashboard-notes-${module}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "dashboard_notes", filter: `module=eq.${module}` },
          fire,
        )
        .subscribe();
    } catch (e) {
      // No Realtime (missing env, blocked socket): the poll and focus
      // checks below still keep the board fresh.
      console.warn("[board-live] realtime unavailable:", (e as Error).message);
    }

    const timer = setInterval(fire, LIVE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fire();
    };
    window.addEventListener("focus", fire);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", fire);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) {
        try {
          channel.unsubscribe();
        } catch {
          /* already gone */
        }
      }
    };
  }, [module, enabled]);
}
