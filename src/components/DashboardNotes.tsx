"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  getDashboardNote,
  getDashboardNoteStamp,
  saveDashboardNote,
  getDashboardNoteVersions,
  revertDashboardNote,
} from "@/actions/dashboard-notes";
import type { DashboardNote, DashboardNoteVersion } from "@/lib/types";
import type { Clash } from "@/lib/board-merge";
import { useBoardLive } from "@/components/useBoardLive";
import type { EntityLookup } from "@/actions/entity-lookup";
import { stripEmojis } from "@/lib/strip-emojis";
import { buildFlagBreakdown, SEGMENT_BREAK } from "@/lib/flagged-lines";
import type { FlagBreakdown } from "@/lib/flagged-lines";

/** How long the user must pause before an autosave and before an incoming
 *  board may replace what they see (v11 step 1). */
const TYPING_PAUSE_MS = 2000;

type MatchedLine = {
  top: number;
  entity: EntityLookup;
  blockIndex: number;
};

type LinkLine = {
  top: number;
  url: string;
};

type StatusLine = {
  top: number;
  blockIndex: number;
};

type MoveLine = {
  top: number;
  blockIndex: number;
};

type DashboardNotesProps = {
  module: "acquisitions" | "acquisitions_b" | "dispositions" | "dispositions_b" | "investor_database" | "agent_outreach" | "investor_outreach" | "agent_outreach_notes" | "investor_outreach_notes" | "deals_marketing" | "jv_partners" | "agent_outreach_quick" | "investor_outreach_quick" | "acq_outreach" | "follow_ups" | "agent_outreach_scratch" | "investor_outreach_scratch";
  entityLookup?: EntityLookup[];
  compact?: boolean;
  linkGutter?: boolean;
  statusGutter?: boolean;
  moveGutter?: boolean;
  followUpGutter?: { onClickAction: (entityId: string, offset: "1week" | "1month") => Promise<void> | void };
  /** Queue-row gutters (14.2 final form): ⚡📤 lines in the board text get
   *  a preview eye in the left gutter and a Send pill in the right one,
   *  the same hang-actions-off-a-marker mechanism as the other gutters.
   *  rows maps line text back to dispo_queue ids; the table stays the
   *  source of truth, the line is its rendering. */
  dispoGutter?: {
    rows: Array<{ id: string; deal_name: string }>;
    onPreview: (queueId: string) => void;
    onSend: (queueId: string) => void;
  };
  minHeight?: string;
  leftStatus?: React.ReactNode;
  onMatchCount?: (count: number) => void;
  /** Fires alongside onMatchCount with the unique IDs of every entity
   *  matched anywhere in the note. Used by the acquisitions reconcile
   *  badge to compare against the active leads in the database. */
  onMatchedIds?: (ids: string[]) => void;
  /** Fires alongside onMatchCount with the flag tally for those matched leads
   *  (Randy 8/10, breakdown 8/12). Computed in the same block scan as the
   *  plain count so the two can never disagree. */
  onFlagBreakdown?: (breakdown: FlagBreakdown) => void;
  onEmojiLineCount?: (count: number) => void;
  onMoveBlock?: (args: { blockHtml: string; remainderHtml: string }) => void | Promise<void>;
  reloadSignal?: number;
  /** Read-only board (Randy, Sept 2026): DSP Deals is written by the app
   *  and by nothing else. The editor is genuinely non-editable rather than
   *  merely left alone by convention, because that board is REBUILT from
   *  dispo_queue and the live rule on every reconcile - anything typed
   *  into it would vanish on the next page load, which is worse than
   *  refusing the keystroke. Server code writes it as before. */
  readOnly?: boolean;
  /** Pre-fetched content from the server. When provided, the editor is seeded
   *  with this immediately instead of doing a client-side fetch on mount. */
  initialContent?: string;
  initialUpdatedAt?: string;
};

export function DashboardNotes({ module, entityLookup = [], compact = false, linkGutter = false, statusGutter = false, moveGutter = false, followUpGutter, dispoGutter, minHeight = "18rem", leftStatus, onMatchCount, onMatchedIds, onFlagBreakdown, onEmojiLineCount, onMoveBlock, reloadSignal, readOnly = false, initialContent, initialUpdatedAt }: DashboardNotesProps) {
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");
  const [conflictMsg, setConflictMsg] = useState("");
  // Live board state (v11 step 1). Refs, not state, because the save and
  // the live signal both need the CURRENT values without re-rendering.
  const baseContentRef = useRef<string>("");   // the board this user started from
  const updatedAtRef = useRef<string>("");
  const lastEditAtRef = useRef<number>(0);
  const pendingIncomingRef = useRef<DashboardNote | null>(null);
  const savingRef = useRef(false);
  // Direct save timer (fix 10/8 after v11 went live): scheduling used to
  // hang off the "saving" status, so a save that finished while the user
  // was still typing could not schedule the next one (the status was
  // already "saving", nothing re-rendered, no timer). The board then sat
  // in "Saving..." with unsaved text and held every incoming board. The
  // timer below is independent of React state; saveRef always points at
  // the latest save() so the timer never calls a stale closure.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveRef.current();
    }, TYPING_PAUSE_MS);
  }, []);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);
  const [mergeNotice, setMergeNotice] = useState<string>("");
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    (DashboardNoteVersion & { editor_name: string })[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [matchedLines, setMatchedLines] = useState<MatchedLine[]>([]);
  const [dispoLines, setDispoLines] = useState<Array<{ top: number; blockIndex: number; queueId: string }>>([]);
  const [linkLines, setLinkLines] = useState<LinkLine[]>([]);
  const [statusLines, setStatusLines] = useState<StatusLine[]>([]);
  const [moveLines, setMoveLines] = useState<MoveLine[]>([]);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [StarterKit, Underline],
    editorProps: {
      attributes: {
        class:
          `prose prose-sm max-w-none font-editable focus:outline-none px-3 py-2 leading-[1.35] ${compact ? "text-[10px]" : "text-xs"} ${readOnly ? "cursor-default select-text" : ""}`,
      },
    },
    onUpdate: () => {
      // Guarded as well as disabled: `editable` blocks typing, and this
      // makes a programmatic setContent unable to start an autosave that
      // would race the next reconcile.
      if (readOnly) return;
      lastEditAtRef.current = Date.now();
      setSaveStatus("saving");
      scheduleSave();
    },
  });

  // Adopt a board as the one this user is now editing from.
  const adopt = useCallback((note: { content: string; updated_at: string }) => {
    baseContentRef.current = note.content || "";
    updatedAtRef.current = note.updated_at;
  }, []);

  // Scan editor content for entity name matches
  const scanForMatches = useCallback(() => {
    if (!editor || !editorWrapperRef.current || entityLookup.length === 0) {
      setMatchedLines([]);
      onFlagBreakdown?.({ total: 0, byEmoji: [], roundWorthy: 0 });
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const matches: MatchedLine[] = [];
    const seenTops = new Set<number>();
    const flaggedLines: string[] = [];

    // Sort entities by name length descending so longer names match first
    const sortedEntities = [...entityLookup].sort((a, b) => b.name.length - a.name.length);

    // Get all paragraph/block elements in the editor
    const blocks = proseMirror.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    blocks.forEach((block, blockIndex) => {
      const text = block.textContent || "";
      if (!text.trim()) return;

      const textLower = stripEmojis(text).toLowerCase();

      for (const entity of sortedEntities) {
        const nameLower = stripEmojis(entity.name).toLowerCase();
        // Match if the entity name appears in this line (at least 2 chars to avoid false positives)
        if (nameLower.length >= 2 && textLower.includes(nameLower)) {
          const blockRect = block.getBoundingClientRect();
          const relativeTop = blockRect.top - wrapperRect.top;
          const roundedTop = Math.round(relativeTop);

          // Only one link per line
          if (!seenTops.has(roundedTop)) {
            seenTops.add(roundedTop);
            matches.push({ top: relativeTop, entity, blockIndex });
            // Same block, same match — the flag tally just reads it too.
            // innerHTML, not textContent: textContent drops <br> entirely,
            // which is what made a two-lead block look flagged.
            flaggedLines.push(
              block.innerHTML
                .replace(/<br\s*\/?>/gi, SEGMENT_BREAK)
                .replace(/<[^>]+>/g, ""),
            );
          }
          break;
        }
      }
    });

    setMatchedLines(matches);
    onMatchCount?.(matches.length);
    onFlagBreakdown?.(buildFlagBreakdown(flaggedLines));
    if (onMatchedIds) {
      // Pass every matched line's id (not deduped) so the reconciliation
      // badge can detect a lead listed multiple times on one dashboard.
      onMatchedIds(matches.map((m) => m.entity.id));
    }
  }, [editor, entityLookup, onMatchCount, onMatchedIds, onFlagBreakdown]);

  // Scan editor content for URLs (for linkGutter mode)
  const scanForLinks = useCallback(() => {
    if (!editor || !editorWrapperRef.current || !linkGutter) {
      setLinkLines([]);
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const links: LinkLine[] = [];
    const urlRegex = /https?:\/\/[^\s<]+/;

    const blocks = proseMirror.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    blocks.forEach((block) => {
      const text = block.textContent || "";
      const match = text.match(urlRegex);
      if (match) {
        const blockRect = block.getBoundingClientRect();
        const relativeTop = blockRect.top - wrapperRect.top;
        links.push({ top: relativeTop, url: match[0] });
      }
    });

    setLinkLines(links);
  }, [editor, linkGutter]);

  // Scan for lines containing 🟢 (for statusGutter mode)
  const scanForStatusLines = useCallback(() => {
    if (!editor || !editorWrapperRef.current || !statusGutter) {
      setStatusLines([]);
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const lines: StatusLine[] = [];
    const blocks = proseMirror.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    blocks.forEach((block, blockIndex) => {
      const text = block.textContent || "";
      if (text.includes("🟢")) {
        const blockRect = block.getBoundingClientRect();
        const relativeTop = blockRect.top - wrapperRect.top;
        lines.push({ top: relativeTop, blockIndex });
      }
    });

    setStatusLines(lines);
  }, [editor, statusGutter]);

  // Scan for ⚡📤 queue lines (dispoGutter mode) — same mechanism as the
  // 🟢 scan above: marker in the text decides which lines carry actions.
  const scanForDispoLines = useCallback(() => {
    if (!editor || !editorWrapperRef.current || !dispoGutter) {
      setDispoLines([]);
      return;
    }
    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const lines: Array<{ top: number; blockIndex: number; queueId: string }> = [];
    const blocks = proseMirror.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    blocks.forEach((block, blockIndex) => {
      const text = block.textContent || "";
      if (!text.includes("⚡📤")) return;
      // Line -> row by deal-name inclusion, the board convention. A line
      // whose name matches no ready row gets no buttons (it is about to
      // be reconciled away anyway).
      const row = dispoGutter.rows.find((r) => text.includes(r.deal_name));
      if (!row) return;
      const blockRect = block.getBoundingClientRect();
      lines.push({ top: blockRect.top - wrapperRect.top, blockIndex, queueId: row.id });
    });
    setDispoLines(lines);
  }, [editor, dispoGutter]);

  // Scan for every block (for moveGutter mode — up-arrow on each non-empty line)
  const scanForMoveLines = useCallback(() => {
    if (!editor || !editorWrapperRef.current || !moveGutter) {
      setMoveLines([]);
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const lines: MoveLine[] = [];
    const blocks = proseMirror.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    blocks.forEach((block, blockIndex) => {
      const text = (block.textContent || "").trim();
      if (!text) return;
      const blockRect = block.getBoundingClientRect();
      const relativeTop = blockRect.top - wrapperRect.top;
      lines.push({ top: relativeTop, blockIndex });
    });

    setMoveLines(lines);
  }, [editor, moveGutter]);

  // Count lines with exactly 2 emojis (for outreach counters)
  const scanForEmojiLines = useCallback(() => {
    if (!editor || !onEmojiLineCount) return;
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.isBlock && node.isTextblock) {
        const text = node.textContent || "";
        const emojis = text.match(emojiRegex);
        if (emojis && emojis.length >= 2) count++;
      }
      return true;
    });
    onEmojiLineCount(count);
  }, [editor, onEmojiLineCount]);

  // Re-scan when editor content changes
  useEffect(() => {
    if (!editor) return;
    // Scan on content changes
    const handler = () => {
      // Small delay to let DOM settle
      requestAnimationFrame(() => {
        scanForMatches();
        scanForLinks();
        scanForStatusLines();
        scanForMoveLines();
        scanForEmojiLines();
        scanForDispoLines();
      });
    };
    editor.on("update", handler);
    editor.on("create", handler);
    // Initial scan after content loads
    const timer = setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForEmojiLines(); scanForDispoLines(); }, 500);
    return () => {
      editor.off("update", handler);
      editor.off("create", handler);
      clearTimeout(timer);
    };
  }, [editor, scanForMatches, scanForLinks, scanForStatusLines, scanForMoveLines, scanForEmojiLines, scanForDispoLines]);

  // Re-scan when save completes (content may have been set externally)
  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForEmojiLines(); scanForDispoLines(); }, 200);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, scanForMatches, scanForLinks, scanForStatusLines, scanForMoveLines, scanForEmojiLines, scanForDispoLines]);

  // Re-scan when statusGutter prop changes (e.g. Show All clicked)
  useEffect(() => {
    if (statusGutter) {
      const timer = setTimeout(scanForStatusLines, 100);
      return () => clearTimeout(timer);
    }
  }, [statusGutter, scanForStatusLines]);

  // Re-scan when the queue rows change (a send or dismiss just removed a
  // line; reloadSignal refreshes the content and this re-hangs buttons)
  useEffect(() => {
    if (dispoGutter) {
      const timer = setTimeout(scanForDispoLines, 100);
      return () => clearTimeout(timer);
    }
  }, [dispoGutter, scanForDispoLines]);

  // Re-scan when moveGutter prop changes
  useEffect(() => {
    if (moveGutter) {
      const timer = setTimeout(scanForMoveLines, 100);
      return () => clearTimeout(timer);
    }
  }, [moveGutter, scanForMoveLines]);

  // Put a board into the editor, keeping the cursor on the same line when
  // the editor has focus (v11 step 1, "never swap mid-typing" is handled
  // by the caller; this only makes the swap gentle).
  const loadIntoEditor = useCallback((note: { content: string; updated_at: string }) => {
    if (!editor) return;
    const hadFocus = editor.isFocused;
    let cursor: { block: number; offset: number } | null = null;
    if (hadFocus) {
      try {
        const $from = editor.state.doc.resolve(editor.state.selection.from);
        cursor = { block: $from.index(0), offset: $from.parentOffset };
      } catch {
        cursor = null;
      }
    }
    editor.commands.setContent(note.content || "");
    if (cursor) {
      try {
        const doc = editor.state.doc;
        if (cursor.block < doc.childCount) {
          let pos = 0;
          for (let i = 0; i < cursor.block; i++) pos += doc.child(i).nodeSize;
          const node = doc.child(cursor.block);
          const target = pos + 1 + Math.min(cursor.offset, Math.max(0, node.content.size));
          editor.commands.setTextSelection(target);
        }
      } catch {
        /* cursor goes to the top; acceptable */
      }
    }
    adopt(note);
    setSaveStatus("saved");
    setConflictMsg("");
    setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForStatusLines(); scanForEmojiLines(); }, 100);
  }, [editor, adopt, scanForMatches, scanForLinks, scanForMoveLines, scanForStatusLines, scanForEmojiLines]);

  // Reload content when reloadSignal changes (after external mutation)
  useEffect(() => {
    if (!editor || reloadSignal === undefined || reloadSignal === 0) return;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success) loadIntoEditor(result.data);
    });
  }, [reloadSignal, module, editor, startTransition, loadIntoEditor]);

  // Load initial content (runs once when editor is ready). When the parent
  // already fetched the note server-side and passed it as initialContent, we
  // seed the editor synchronously with no client fetch — eliminating the
  // "blank dashboard pops to populated" flash.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (initialContent !== undefined) {
      editor.commands.setContent(initialContent || "");
      adopt({ content: initialContent || "", updated_at: initialUpdatedAt ?? "" });
      setSaveStatus("saved");
      setTimeout(() => { scanForMatches(); scanForLinks(); scanForEmojiLines(); }, 100);
      return;
    }

    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success) {
        editor.commands.setContent(result.data.content || "");
        adopt(result.data);
        setSaveStatus("saved");
        setTimeout(() => { scanForMatches(); scanForLinks(); scanForEmojiLines(); }, 100);
      }
    });
  }, [module, editor, startTransition, scanForMatches, scanForLinks, scanForStatusLines, scanForEmojiLines, initialContent, initialUpdatedAt, adopt]);

  // Is the user mid-typing? Hold incoming boards until a 2-second pause.
  const isTyping = useCallback(() => Date.now() - lastEditAtRef.current < TYPING_PAUSE_MS, []);

  // Autosave with line-level merge (v11 step 1).
  const save = useCallback(async () => {
    // Third guard, and the one that actually matters: a read-only board
    // must never reach the save action. The other two stop the user
    // and the editor; this stops the code path itself, so a future caller
    // that sets saveStatus directly cannot overwrite a generated board.
    if (readOnly) return;
    if (!editor || !updatedAtRef.current) return;
    if (savingRef.current) {
      scheduleSave();
      return;
    }
    savingRef.current = true;
    try {
      const content = editor.getHTML();
      const result = await saveDashboardNote(module, content, baseContentRef.current, updatedAtRef.current);
      if (result.success) {
        const { note, clashes: lost, mergedWith } = result.data;
        if (lost.length > 0) {
          setClashes((prev) => [...prev, ...lost]);
          setMergeNotice(
            lost.length === 1
              ? `${mergedWith ?? "Someone"} just changed ${lost[0].label}'s line, your edit wasn't saved`
              : `${mergedWith ?? "Someone"} just changed ${lost.length} lines you edited, those edits weren't saved`
          );
        } else if (mergedWith) {
          setMergeNotice(`Merged with ${mergedWith}'s changes`);
          setTimeout(() => setMergeNotice((m) => (m.startsWith("Merged with") ? "" : m)), 4000);
        }
        // A newer board came in while we were typing; or the merge pulled
        // in other people's lines. Either way, if the user is still
        // typing, hold it; the next save will merge again.
        const incoming = pendingIncomingRef.current;
        pendingIncomingRef.current = null;
        const newest = incoming && incoming.updated_at > note.updated_at ? incoming : note;
        if (newest.content !== editor.getHTML()) {
          if (isTyping()) {
            adopt(note);
            pendingIncomingRef.current = newest;
            setSaveStatus("saving");
            scheduleSave();
          } else {
            loadIntoEditor(newest);
          }
        } else {
          adopt(note);
          setSaveStatus("saved");
          setConflictMsg("");
        }
      } else if (result.error.startsWith("CONFLICT:")) {
        const parts = result.error.split(":");
        setConflictMsg(`${parts[1]} edited this note. Reload to see changes.`);
        setSaveStatus("conflict");
      } else {
        setSaveStatus("error");
      }
    } finally {
      savingRef.current = false;
      // Anything typed while the save was in flight is still unsaved.
      if (editor && !readOnly && editor.getHTML() !== baseContentRef.current && updatedAtRef.current) {
        scheduleSave();
      }
    }
  }, [editor, module, readOnly, adopt, loadIntoEditor, isTyping, scheduleSave]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Something changed in the database (Realtime, 30s check, or tab
  // focus): fetch the stamp, then the board, and apply it unless the user
  // is typing, in which case hold it for the post-save swap.
  const checkForNewer = useCallback(() => {
    if (!editor) return;
    startTransition(async () => {
      const stamp = await getDashboardNoteStamp(module);
      if (!stamp.success) return;
      const known = pendingIncomingRef.current?.updated_at ?? updatedAtRef.current;
      if (!known || stamp.data.updated_at === known) return;
      const result = await getDashboardNote(module);
      if (!result.success) return;
      if (result.data.updated_at === updatedAtRef.current) return;
      if (!readOnly && (isTyping() || saveStatus === "saving" || savingRef.current)) {
        pendingIncomingRef.current = result.data;
        return;
      }
      loadIntoEditor(result.data);
    });
  }, [editor, module, readOnly, isTyping, saveStatus, loadIntoEditor, startTransition]);

  useBoardLive(module, checkForNewer, !!editor);

  async function loadVersions() {
    const result = await getDashboardNoteVersions(module);
    if (result.success) {
      setVersions(result.data);
      setShowVersions(true);
    }
  }

  async function handleRevert(versionId: string) {
    const result = await revertDashboardNote(module, versionId);
    if (result.success && editor) {
      loadIntoEditor(result.data);
      setShowVersions(false);
    }
  }

  if (!editor) return null;

  function getRecordUrl(entity: EntityLookup) {
    return entity.type === "lead"
      ? `/app/acquisitions/lead-record/${entity.id}`
      : `/app/dispositions/investor-record/${entity.id}`;
  }

  function toggleStatusEmoji(targetBlockIndex: number, emoji: string) {
    if (!editor) return;

    let endPos = 0;
    let found = false;
    let currentIndex = 0;
    let nodeText = "";
    editor.state.doc.descendants((node, nodePos) => {
      if (found) return false;
      if (node.isBlock && node.isTextblock) {
        if (currentIndex === targetBlockIndex) {
          endPos = nodePos + node.nodeSize - 1;
          nodeText = node.textContent;
          found = true;
          return false;
        }
        currentIndex++;
      }
      return true;
    });

    if (!found) return;

    if (nodeText.endsWith(emoji)) {
      editor.chain().focus().deleteRange({ from: endPos - emoji.length, to: endPos }).run();
    } else {
      const statusEmojis = ["✅", "❌", "⚠️"];
      for (const se of statusEmojis) {
        if (nodeText.endsWith(se)) {
          editor.chain().focus().deleteRange({ from: endPos - se.length, to: endPos }).run();
          endPos = endPos - se.length;
          break;
        }
      }
      editor.chain().focus().insertContentAt(endPos, emoji).run();
    }
  }

  function promoteBlock(targetBlockIndex: number) {
    if (!editor || !onMoveBlock) return;

    // Find the target block's document positions
    let targetFrom = 0;
    let targetTo = 0;
    let found = false;
    let currentIndex = 0;

    editor.state.doc.descendants((node, nodePos) => {
      if (found) return false;
      if (node.isBlock && node.isTextblock) {
        if (currentIndex === targetBlockIndex) {
          targetFrom = nodePos;
          targetTo = nodePos + node.nodeSize;
          found = true;
          return false;
        }
        currentIndex++;
      }
      return true;
    });

    if (!found) return;

    // Render the target block's HTML from the DOM
    const blocks = editor.view.dom.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
    const blockEl = blocks[targetBlockIndex];
    if (!blockEl) return;
    const tmp = document.createElement("div");
    tmp.appendChild(blockEl.cloneNode(true));
    const blockHtml = tmp.innerHTML;

    // Remove the block from the source editor
    editor.chain().focus().deleteRange({ from: targetFrom, to: targetTo }).run();

    // Get the remainder after removal
    const remainderHtml = editor.getHTML();

    // Fire callback — parent handles the atomic move via server action
    onMoveBlock({ blockHtml, remainderHtml });
  }

  function toggleCheckmark(targetBlockIndex: number) {
    if (!editor) return;

    let endPos = 0;
    let found = false;
    let currentIndex = 0;
    let nodeText = "";
    editor.state.doc.descendants((node, nodePos) => {
      if (found) return false;
      if (node.isBlock && node.isTextblock) {
        if (currentIndex === targetBlockIndex) {
          endPos = nodePos + node.nodeSize - 1;
          nodeText = node.textContent;
          found = true;
          return false;
        }
        currentIndex++;
      }
      return true;
    });

    if (!found) return;

    if (nodeText.endsWith("✅")) {
      // Remove the checkmark (✅ is one character)
      editor.chain().focus().deleteRange({ from: endPos - 1, to: endPos }).run();
    } else {
      editor.chain().focus().insertContentAt(endPos, "✅").run();
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Editor with link gutter */}
      <div className="flex relative flex-1 min-h-0" ref={editorWrapperRef}>
        {/* Left gutter — move buttons OR entity-link indicators */}
        <div className="relative w-5 shrink-0 overflow-hidden">
          {moveGutter
            ? moveLines.map((m, i) => (
                <button
                  key={`move-${i}`}
                  type="button"
                  onClick={() => promoteBlock(m.blockIndex)}
                  title="Move to ACQ Outreach"
                  className="absolute left-0 flex items-center justify-center w-4 h-4 text-neutral-300 hover:text-blue-600 transition-colors"
                  style={{ top: `${m.top + 2 }px` }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              ))
            : matchedLines.filter((m) => !dispoLines.some((d) => d.blockIndex === m.blockIndex)).map((m, i) => (
                <a
                  key={`${m.entity.id}-${i}`}
                  href={getRecordUrl(m.entity)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${m.entity.name}`}
                  className="absolute left-0 flex items-center justify-center w-4 h-4 rounded-full text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  style={{ top: `${m.top + 2 }px` }}
                >
                  <span className="block h-2 w-2 rounded-full bg-current" />
                </a>
              ))}
          {/* dispoGutter: preview eye on ⚡📤 queue lines (14.2 final form) */}
          {dispoLines.map((d) => (
            <button
              key={`dispo-prev-${d.queueId}-${d.blockIndex}`}
              type="button"
              onClick={() => dispoGutter?.onPreview(d.queueId)}
              title="Preview the queued text + email"
              aria-label="Preview queued messages"
              className="absolute left-0 flex items-center justify-center w-4 h-4 rounded-full text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              style={{ top: `${d.top + 2}px` }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          ))}
        </div>
        {/* Editor */}
        <div
          className="flex-1 rounded-md border border-dashed border-neutral-400 bg-neutral-50 overflow-y-auto minimal-scrollbar"
          style={{ minHeight }}
        >
          <EditorContent editor={editor} />
        </div>
        {/* Right gutter — status buttons, checkmarks, link arrows, or follow-up buttons */}
        <div className={`relative shrink-0 overflow-hidden ${statusGutter ? "w-12 ml-1.5" : followUpGutter ? "w-10 ml-1" : dispoGutter ? "w-14 ml-1.5" : "w-5"}`}>
          {/* dispoGutter: persistent Send pill on ⚡📤 queue lines - the
              action that moves money never hides behind hover */}
          {dispoLines.map((d) => (
            <button
              key={`dispo-send-${d.queueId}-${d.blockIndex}`}
              type="button"
              onClick={() => dispoGutter?.onSend(d.queueId)}
              title="Open the send wizard"
              aria-label="Send this deal"
              className="absolute right-0 rounded border border-dashed border-[#c5cca8] bg-[#e8edda] px-1.5 py-px text-[10px] font-semibold text-neutral-700 hover:bg-[#dce3cb] dark:bg-[#3a4030] dark:text-neutral-200"
              style={{ top: `${d.top}px` }}
            >
              Send
            </button>
          ))}
          {statusGutter
            ? statusLines.map((s, i) => (
                <div
                  key={`status-${i}`}
                  className="absolute right-0 flex items-center gap-0.5"
                  style={{ top: `${s.top + 1 }px` }}
                >
                  <button
                    type="button"
                    onClick={() => toggleStatusEmoji(s.blockIndex, "✅")}
                    title="Mark complete"
                    className="flex items-center justify-center w-4 h-4 text-[9px] text-neutral-300 hover:text-green-600 transition-colors"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatusEmoji(s.blockIndex, "❌")}
                    title="Mark declined"
                    className="flex items-center justify-center w-4 h-4 text-[9px] text-neutral-300 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatusEmoji(s.blockIndex, "⚠️")}
                    title="Flag for attention"
                    className="flex items-center justify-center w-4 h-4 text-[9px] text-neutral-300 hover:text-amber-500 transition-colors"
                  >
                    !
                  </button>
                </div>
              ))
            : linkGutter
              ? linkLines.map((l, i) => (
                  <a
                    key={`link-${i}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.url}
                    className="absolute right-0 flex items-center justify-center w-4 h-4 text-[10px] text-neutral-300 hover:text-blue-600 transition-colors"
                    style={{ top: `${l.top + 2 }px` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                ))
              : followUpGutter
                ? matchedLines.map((m, i) => (
                    <div
                      key={`fu-${m.entity.id}-${i}`}
                      className="absolute right-0 flex items-center gap-0.5"
                      style={{ top: `${m.top + 2}px` }}
                    >
                      <button
                        type="button"
                        onClick={() => followUpGutter.onClickAction(m.entity.id, "1week")}
                        title={`Set 1 week follow-up for ${m.entity.name}`}
                        aria-label="Set 1 week follow-up"
                        className="flex items-center justify-center w-4 h-4 text-[8px] font-bold text-neutral-300 hover:text-yellow-700 transition-colors"
                      >
                        1w
                      </button>
                      <button
                        type="button"
                        onClick={() => followUpGutter.onClickAction(m.entity.id, "1month")}
                        title={`Set 1 month follow-up for ${m.entity.name}`}
                        aria-label="Set 1 month follow-up"
                        className="flex items-center justify-center w-4 h-4 text-[8px] font-bold text-neutral-300 hover:text-yellow-700 transition-colors"
                      >
                        1m
                      </button>
                    </div>
                  ))
                : matchedLines.filter((m) => !dispoLines.some((d) => d.blockIndex === m.blockIndex)).map((m, i) => (
                    <button
                      key={`check-${m.entity.id}-${i}`}
                      type="button"
                      onClick={() => toggleCheckmark(m.blockIndex)}
                      title={`Mark ${m.entity.name} as updated`}
                      className="absolute right-0 flex items-center justify-center w-4 h-4 text-[10px] text-neutral-300 hover:text-green-600 transition-colors group"
                      style={{ top: `${m.top + 2 }px` }}
                    >
                      <span className="group-hover:hidden">–</span>
                      <span className="hidden group-hover:inline">✓</span>
                    </button>
                  ))}
        </div>
      </div>

      {/* Status bar — pinned at bottom, aligned with editor (skip gutters) */}
      <div className={`flex items-center ${leftStatus ? "justify-between" : "justify-end"} gap-2 text-xs text-neutral-400 shrink-0 pt-1 ml-5 mr-5`}>
        {leftStatus && <div className="flex items-center gap-2">{leftStatus}</div>}
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "saving" && "Saving..."}
          {saveStatus === "error" && (
            <span className="text-red-500">Save failed</span>
          )}
          {saveStatus === "conflict" && (
            <span className="text-orange-500">{conflictMsg}</span>
          )}
          {mergeNotice && saveStatus !== "conflict" && (
            <span className={clashes.length > 0 ? "text-orange-500" : "text-neutral-400"}>{mergeNotice}</span>
          )}
          <button
            type="button"
            onClick={loadVersions}
            className="underline hover:text-neutral-600"
          >
            History
          </button>
        </div>
      </div>

      {/* Lines that lost a same-line clash (v11 step 1): the first save
          won, and the user's text is shown here so nothing is lost
          silently. Stays until dismissed. */}
      {clashes.length > 0 && (
        <div className="rounded-md border border-dashed border-orange-300 bg-orange-50 p-3 text-xs dark:border-orange-700 dark:bg-orange-950/40">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-orange-700 dark:text-orange-300">Your text, so you can re-add it</span>
            <button
              type="button"
              onClick={() => { setClashes([]); setMergeNotice(""); }}
              className="text-orange-500 hover:text-orange-700"
            >
              Dismiss
            </button>
          </div>
          <ul className="space-y-1">
            {clashes.map((c, i) => (
              <li key={i} className="font-editable whitespace-pre-wrap text-neutral-700 dark:text-neutral-200 select-all">
                {c.mine || `(you removed ${c.label}'s line)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Version history panel */}
      {showVersions && (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-neutral-700">
              Version History
            </h4>
            <button
              type="button"
              onClick={() => setShowVersions(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Close
            </button>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-neutral-400">No previous versions</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-neutral-600">
                    {new Date(v.created_at).toLocaleString()} — {v.editor_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevert(v.id)}
                    disabled={isPending}
                    className="text-blue-600 hover:underline"
                  >
                    Revert
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
