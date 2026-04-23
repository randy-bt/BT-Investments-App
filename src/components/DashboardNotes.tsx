"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  getDashboardNote,
  updateDashboardNote,
  getDashboardNoteVersions,
  revertDashboardNote,
} from "@/actions/dashboard-notes";
import type { DashboardNoteVersion } from "@/lib/types";
import type { EntityLookup } from "@/actions/entity-lookup";

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
  module: "acquisitions" | "acquisitions_b" | "dispositions" | "investor_database" | "agent_outreach" | "investor_outreach" | "agent_outreach_notes" | "investor_outreach_notes" | "deals_marketing" | "jv_partners" | "agent_outreach_quick" | "investor_outreach_quick" | "acq_outreach";
  entityLookup?: EntityLookup[];
  compact?: boolean;
  linkGutter?: boolean;
  statusGutter?: boolean;
  moveGutter?: boolean;
  minHeight?: string;
  leftStatus?: React.ReactNode;
  onMatchCount?: (count: number) => void;
  onEmojiLineCount?: (count: number) => void;
  onMoveBlock?: (args: { blockHtml: string; remainderHtml: string }) => void | Promise<void>;
  reloadSignal?: number;
};

export function DashboardNotes({ module, entityLookup = [], compact = false, linkGutter = false, statusGutter = false, moveGutter = false, minHeight = "18rem", leftStatus, onMatchCount, onEmojiLineCount, onMoveBlock, reloadSignal }: DashboardNotesProps) {
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");
  const [conflictMsg, setConflictMsg] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    (DashboardNoteVersion & { editor_name: string })[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [matchedLines, setMatchedLines] = useState<MatchedLine[]>([]);
  const [linkLines, setLinkLines] = useState<LinkLine[]>([]);
  const [statusLines, setStatusLines] = useState<StatusLine[]>([]);
  const [moveLines, setMoveLines] = useState<MoveLine[]>([]);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    editorProps: {
      attributes: {
        class:
          `prose prose-sm max-w-none font-editable focus:outline-none px-3 py-2 leading-[1.35] ${compact ? "text-[10px]" : "text-xs"}`,
      },
    },
    onUpdate: () => {
      setSaveStatus("saving");
    },
  });

  // Scan editor content for entity name matches
  const scanForMatches = useCallback(() => {
    if (!editor || !editorWrapperRef.current || entityLookup.length === 0) {
      setMatchedLines([]);
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const proseMirror = wrapper.querySelector(".ProseMirror");
    if (!proseMirror) return;

    const matches: MatchedLine[] = [];
    const seenTops = new Set<number>();

    // Strip emojis so they don't interfere with name matching
    const stripEmojis = (str: string) =>
      str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();

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
          }
          break;
        }
      }
    });

    setMatchedLines(matches);
    onMatchCount?.(matches.length);
  }, [editor, entityLookup, onMatchCount]);

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
      });
    };
    editor.on("update", handler);
    editor.on("create", handler);
    // Initial scan after content loads
    const timer = setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForEmojiLines(); }, 500);
    return () => {
      editor.off("update", handler);
      editor.off("create", handler);
      clearTimeout(timer);
    };
  }, [editor, scanForMatches, scanForLinks, scanForStatusLines, scanForMoveLines, scanForEmojiLines]);

  // Re-scan when save completes (content may have been set externally)
  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForEmojiLines(); }, 200);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, scanForMatches, scanForLinks, scanForStatusLines, scanForMoveLines, scanForEmojiLines]);

  // Re-scan when statusGutter prop changes (e.g. Show All clicked)
  useEffect(() => {
    if (statusGutter) {
      const timer = setTimeout(scanForStatusLines, 100);
      return () => clearTimeout(timer);
    }
  }, [statusGutter, scanForStatusLines]);

  // Re-scan when moveGutter prop changes
  useEffect(() => {
    if (moveGutter) {
      const timer = setTimeout(scanForMoveLines, 100);
      return () => clearTimeout(timer);
    }
  }, [moveGutter, scanForMoveLines]);

  // Reload content when reloadSignal changes (after external mutation)
  useEffect(() => {
    if (!editor || reloadSignal === undefined || reloadSignal === 0) return;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success) {
        editor.commands.setContent(result.data.content || "");
        setUpdatedAt(result.data.updated_at);
        setSaveStatus("saved");
        setTimeout(() => { scanForMatches(); scanForLinks(); scanForMoveLines(); scanForStatusLines(); scanForEmojiLines(); }, 100);
      }
    });
  }, [reloadSignal, module, editor, startTransition, scanForMatches, scanForLinks, scanForMoveLines, scanForStatusLines, scanForEmojiLines]);

  // Load initial content (runs once when editor is ready)
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success) {
        editor.commands.setContent(result.data.content || "");
        setUpdatedAt(result.data.updated_at);
        setSaveStatus("saved");
        setTimeout(() => { scanForMatches(); scanForLinks(); scanForEmojiLines(); }, 100);
      }
    });
  }, [module, editor, startTransition, scanForMatches, scanForLinks, scanForStatusLines, scanForEmojiLines]);

  // Autosave with debounce
  const save = useCallback(async () => {
    if (!editor || !updatedAt) return;
    const content = editor.getHTML();
    const result = await updateDashboardNote(module, content, updatedAt);
    if (result.success) {
      setUpdatedAt(result.data.updated_at);
      setSaveStatus("saved");
      setConflictMsg("");
    } else if (result.error.startsWith("CONFLICT:")) {
      const parts = result.error.split(":");
      setConflictMsg(
        `${parts[1]} edited this note. Reload to see changes.`
      );
      setSaveStatus("conflict");
    } else {
      setSaveStatus("error");
    }
  }, [editor, module, updatedAt]);

  useEffect(() => {
    if (saveStatus !== "saving") return;
    const timer = setTimeout(save, 1500);
    return () => clearTimeout(timer);
  }, [saveStatus, save]);

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
      editor.commands.setContent(result.data.content || "");
      setUpdatedAt(result.data.updated_at);
      setShowVersions(false);
      setSaveStatus("saved");
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
            : matchedLines.map((m, i) => (
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
        </div>
        {/* Editor */}
        <div
          className="flex-1 rounded-md border border-dashed border-neutral-400 bg-neutral-50 overflow-y-auto minimal-scrollbar"
          style={{ minHeight }}
        >
          <EditorContent editor={editor} />
        </div>
        {/* Right gutter — status buttons, checkmarks, or link arrows */}
        <div className={`relative shrink-0 overflow-hidden ${statusGutter ? "w-12 ml-1.5" : "w-5"}`}>
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
              : matchedLines.map((m, i) => (
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
          <button
            type="button"
            onClick={loadVersions}
            className="underline hover:text-neutral-600"
          >
            History
          </button>
        </div>
      </div>

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
