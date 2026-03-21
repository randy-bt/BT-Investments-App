"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
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

type DashboardNotesProps = {
  module: "acquisitions" | "dispositions" | "investor_database";
};

export function DashboardNotes({ module }: DashboardNotesProps) {
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none font-editable focus:outline-none min-h-[6rem] px-3 py-2 text-xs leading-relaxed",
      },
    },
    onUpdate: () => {
      setSaveStatus("saving");
    },
  });

  // Load initial content
  useEffect(() => {
    startTransition(async () => {
      const result = await getDashboardNote(module);
      if (result.success && editor) {
        editor.commands.setContent(result.data.content || "");
        setUpdatedAt(result.data.updated_at);
        setSaveStatus("saved");
      }
    });
  }, [module, editor, startTransition]);

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

  return (
    <div className="space-y-1">
      {/* Editor */}
      <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-neutral-400">
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
