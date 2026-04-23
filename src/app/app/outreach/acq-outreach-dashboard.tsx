"use client";

import { useEffect, useState, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { getDashboardNote } from "@/actions/dashboard-notes";
import type { EntityLookup } from "@/actions/entity-lookup";

function countEmojiLines(html: string): number {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const text = html.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "");
  let count = 0;
  for (const line of text.split("\n")) {
    const emojis = line.match(emojiRegex);
    if (emojis && emojis.length >= 2) count++;
  }
  return count;
}

type Props = {
  entityLookup: EntityLookup[];
  reloadSignal: number;
};

export function AcqOutreachDashboard({ entityLookup, reloadSignal }: Props) {
  const storageKey = "outreach-collapsed-acq_outreach";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : true;
  });
  const [emojiCount, setEmojiCount] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote("acq_outreach");
      if (result.success && result.data.content) {
        setEmojiCount(countEmojiLines(result.data.content));
      }
    });
  }, [reloadSignal]);

  const countDisplay = emojiCount !== null && emojiCount > 0 ? ` (${emojiCount})` : "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-5 h-5 rounded text-neutral-400 hover:text-neutral-700 text-sm font-mono leading-none"
        >
          {collapsed ? "+" : "−"}
        </button>
        <h2 className="text-sm font-medium text-neutral-700">ACQ Outreach Dashboard{countDisplay}</h2>
      </div>
      {!collapsed && (
        <DashboardNotes
          module="acq_outreach"
          entityLookup={entityLookup}
          onEmojiLineCount={setEmojiCount}
          reloadSignal={reloadSignal}
        />
      )}
    </div>
  );
}
