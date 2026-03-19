"use client";

import { useState, useTransition } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createUpdate, editUpdate, deleteUpdate } from "@/actions/updates";
import type { Update, EntityType } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

type ActivityFeedProps = {
  entityType: EntityType;
  entityId: string;
  initialUpdates: UpdateWithAuthor[];
};

export function ActivityFeed({
  entityType,
  entityId,
  initialUpdates,
}: ActivityFeedProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState(initialUpdates);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!newContent.trim()) return;
    startTransition(async () => {
      const result = await createUpdate({
        entity_type: entityType,
        entity_id: entityId,
        content: newContent.trim(),
      });
      if (result.success) {
        setUpdates((prev) => [
          { ...result.data, author_name: user.name },
          ...prev,
        ]);
        setNewContent("");
      }
    });
  }

  function handleEdit(id: string) {
    startTransition(async () => {
      const result = await editUpdate(id, { content: editContent });
      if (result.success) {
        setUpdates((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, content: result.data.content } : u
          )
        );
        setEditingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteUpdate(id);
      if (result.success) {
        setUpdates((prev) => prev.filter((u) => u.id !== id));
      }
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-neutral-700">
        Notes / Activity
      </h3>

      {/* Add new update */}
      <div className="flex gap-2">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newContent.trim()}
          className="self-end rounded border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-xs hover:bg-neutral-100 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Updates list */}
      <ul className="space-y-2">
        {updates.map((update) => (
          <li
            key={update.id}
            className="rounded border border-dashed border-neutral-200 p-2"
          >
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
              <span>
                {update.author_name} &mdash;{" "}
                {new Date(update.created_at).toLocaleString()}
              </span>
              {update.author_id === user.id && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(update.id);
                      setEditContent(update.content);
                    }}
                    className="hover:text-neutral-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(update.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            {editingId === update.id ? (
              <div className="flex gap-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable resize-none"
                />
                <div className="flex flex-col gap-1 self-end">
                  <button
                    type="button"
                    onClick={() => handleEdit(update.id)}
                    disabled={isPending}
                    className="rounded border border-neutral-400 px-2 py-0.5 text-xs hover:bg-neutral-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                {update.content}
              </p>
            )}
          </li>
        ))}
      </ul>

      {updates.length === 0 && (
        <p className="text-xs text-neutral-400">No notes yet</p>
      )}
    </div>
  );
}
