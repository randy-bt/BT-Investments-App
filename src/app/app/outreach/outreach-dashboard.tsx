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

type SeededNote = { content: string; updatedAt: string };

export function OutreachDashboard({
  title,
  scriptType,
  module,
  quickModule,
  notesModule,
  entityLookup,
  matchEntities = true,
  reloadSignal,
  initialMain,
  initialQuick,
  initialNotes,
  scratchModule,
  initialScratch,
  defaultOpen = false,
}: {
  title: string;
  scriptType: "agent_outreach" | "investor_outreach";
  module: "agent_outreach" | "investor_outreach";
  quickModule: "agent_outreach_quick" | "investor_outreach_quick";
  notesModule: "agent_outreach_notes" | "investor_outreach_notes";
  entityLookup: EntityLookup[];
  /** Resolve names on this board to lead/investor records, which is what puts
   *  the clickable dot in the left gutter. Off for agent outreach: agents are
   *  not records, so every match there is a false one (Randy, Oct 2026). */
  matchEntities?: boolean;
  reloadSignal?: number;
  initialMain?: SeededNote;
  initialQuick?: SeededNote;
  initialNotes?: SeededNote;
  /** The Quick notes board beside the main list (Acquisitions consolidation,
   *  Randy Oct 2026): a free space for Aldo. A NEW module, never one of the
   *  _quick ones - those are the Additional Notes boards. */
  scratchModule?: "agent_outreach_scratch" | "investor_outreach_scratch";
  initialScratch?: SeededNote;
  /** Open on arrival. Set when the dashboard is alone on its tab (Randy,
   *  Oct 2 2026): collapsed-by-default made sense with two boards stacked
   *  on one page, not with one board that IS the page. Still not
   *  remembered across visits. */
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Always collapsed on arrival (Randy, Oct 2026: "anytime we go in there we
  // have to actually expand it to start working"). Deliberately NOT
  // remembered across visits - the previous build persisted this in
  // localStorage, which meant a board left open stayed open forever and the
  // page greeted him with whatever state he abandoned last time.
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [emojiCount, setEmojiCount] = useState<number | null>(
    initialMain?.content ? countEmojiLines(initialMain.content) : null
  );
  const [, startTransition] = useTransition();

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  // Fetch initial count on mount (works even when collapsed) + refresh on reloadSignal.
  // Skip the very first fetch when we already have seeded content from the server.
  useEffect(() => {
    if ((reloadSignal === undefined || reloadSignal === 0) && initialMain !== undefined) return;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && result.data.content) {
        setEmojiCount(countEmojiLines(result.data.content));
      }
    });
  }, [module, reloadSignal, initialMain]);

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
              entityLookup={matchEntities ? entityLookup : []}
              minHeight="6rem"
              initialContent={initialQuick?.content}
              initialUpdatedAt={initialQuick?.updatedAt}
            />
          }
          additionalNotes={
            <DashboardNotes
              module={notesModule}
              entityLookup={matchEntities ? entityLookup : []}
              initialContent={initialNotes?.content}
              initialUpdatedAt={initialNotes?.updatedAt}
            />
          }
        >
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex min-h-0 min-w-0 flex-[3] flex-col">
              <DashboardNotes
                module={module}
                entityLookup={matchEntities ? entityLookup : []}
                statusGutter={expanded}
                reloadSignal={reloadSignal}
                onEmojiLineCount={setEmojiCount}
                initialContent={initialMain?.content}
                initialUpdatedAt={initialMain?.updatedAt}
              />
            </div>
            {scratchModule && (
              <div className="flex min-h-0 min-w-0 flex-[2] flex-col border-l border-dashed border-neutral-300 pl-4 dark:border-neutral-700">
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-neutral-400">Quick notes</p>
                <DashboardNotes
                  module={scratchModule}
                  entityLookup={[]}
                  initialContent={initialScratch?.content}
                  initialUpdatedAt={initialScratch?.updatedAt}
                />
              </div>
            )}
          </div>
        </ExpandableCard>
      )}
    </div>
  );
}
