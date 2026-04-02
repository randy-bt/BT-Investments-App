"use client";

import { useState, useEffect, useTransition } from "react";
import { DashboardNotes } from "@/components/DashboardNotes";
import { CallScriptViewer } from "@/components/CallScriptViewer";
import { ExpandableCard } from "./expandable-card";
import { getDashboardNote } from "@/actions/dashboard-notes";
import type { EntityLookup } from "@/actions/entity-lookup";

function countEmojiLines(html: string): number {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  // Strip HTML tags to get text per block, split by block-level tags
  const text = html.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "");
  let count = 0;
  for (const line of text.split("\n")) {
    const emojis = line.match(emojiRegex);
    if (emojis && emojis.length >= 2) count++;
  }
  return count;
}

export function OutreachDashboard({
  title,
  scriptType,
  module,
  quickModule,
  notesModule,
  entityLookup,
}: {
  title: string;
  scriptType: "agent_outreach" | "investor_outreach";
  module: "agent_outreach" | "investor_outreach";
  quickModule: "agent_outreach_quick" | "investor_outreach_quick";
  notesModule: "agent_outreach_notes" | "investor_outreach_notes";
  entityLookup: EntityLookup[];
}) {
  const storageKey = `outreach-collapsed-${module}`;
  const [expanded, setExpanded] = useState(false);
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

  // Fetch initial count on mount (works even when collapsed)
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        setEmojiCount(countEmojiLines(result.data.content));
      }
    });
  }, [module]);

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
        <h2 className="text-sm font-medium text-neutral-700">{title}{countDisplay}</h2>
        <div className="ml-auto">
          <CallScriptViewer scriptType={scriptType} />
        </div>
      </div>
      {!collapsed && (
        <ExpandableCard
          onExpandChange={setExpanded}
          quickNotes={
            <DashboardNotes
              module={quickModule}
              entityLookup={entityLookup}
              minHeight="6rem"
            />
          }
          additionalNotes={
            <DashboardNotes
              module={notesModule}
              entityLookup={entityLookup}
            />
          }
        >
          <div className="flex-1 flex flex-col min-h-0">
            <DashboardNotes
              module={module}
              entityLookup={entityLookup}
              statusGutter={expanded}
              onEmojiLineCount={setEmojiCount}
            />
          </div>
        </ExpandableCard>
      )}
    </div>
  );
}
