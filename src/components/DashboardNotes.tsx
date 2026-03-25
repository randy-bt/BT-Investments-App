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
};

type DashboardNotesProps = {
  module: "acquisitions" | "dispositions" | "investor_database" | "agent_outreach" | "investor_outreach" | "agent_outreach_notes" | "investor_outreach_notes";
  entityLookup?: EntityLookup[];
};

export function DashboardNotes({ module, entityLookup = [] }: DashboardNotesProps) {
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
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none font-editable focus:outline-none min-h-[18rem] px-3 py-2 text-xs leading-[1.35]",
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
    blocks.forEach((block) => {
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
            matches.push({ top: relativeTop, entity });
          }
          break;
        }
      }
    });

    setMatchedLines(matches);
  }, [editor, entityLookup]);

  // Re-scan when editor content changes
  useEffect(() => {
    if (!editor) return;
    // Scan on content changes
    const handler = () => {
      // Small delay to let DOM settle
      requestAnimationFrame(scanForMatches);
    };
    editor.on("update", handler);
    editor.on("create", handler);
    // Initial scan after content loads
    const timer = setTimeout(scanForMatches, 500);
    return () => {
      editor.off("update", handler);
      editor.off("create", handler);
      clearTimeout(timer);
    };
  }, [editor, scanForMatches]);

  // Re-scan when save completes (content may have been set externally)
  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(scanForMatches, 200);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, scanForMatches]);

  // Load initial content
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && editor) {
        editor.commands.setContent(result.data.content || "");
        setUpdatedAt(result.data.updated_at);
        setSaveStatus("saved");
        // Scan after content is set and DOM has updated
        setTimeout(scanForMatches, 100);
      }
    });
  }, [module, editor, startTransition, scanForMatches]);

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Editor with link gutter */}
      <div className="flex relative flex-1 min-h-0" ref={editorWrapperRef}>
        {/* Link gutter */}
        <div className="relative w-5 shrink-0">
          {matchedLines.map((m, i) => (
            <a
              key={`${m.entity.id}-${i}`}
              href={getRecordUrl(m.entity)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${m.entity.name}`}
              className="absolute left-0 flex items-center justify-center w-4 h-4 rounded-full text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              style={{ top: `${m.top + 2}px` }}
            >
              <span className="block h-2 w-2 rounded-full bg-current" />
            </a>
          ))}
        </div>
        {/* Editor */}
        <div className="flex-1 rounded-md border border-dashed border-neutral-400 bg-neutral-50 overflow-y-auto minimal-scrollbar">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Status bar — pinned at bottom */}
      <div className="flex items-center justify-end gap-2 text-xs text-neutral-400 shrink-0 pt-1">
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
