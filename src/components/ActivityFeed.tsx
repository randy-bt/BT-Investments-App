"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createUpdate, editUpdate, deleteUpdate } from "@/actions/updates";
import {
  listAttachments,
  getDownloadUrl,
  deleteAttachment,
} from "@/actions/attachments";
import type { Update, EntityType, Attachment } from "@/lib/types";

type UpdateWithAuthor = Update & { author_name: string };

export type HashtagField = {
  key: string;
  label: string;
  type: "text" | "number";
};

type ActivityFeedProps = {
  entityType: EntityType;
  entityId: string;
  initialUpdates: UpdateWithAuthor[];
  hashtagFields?: HashtagField[];
  onHashtagUpdate?: (updates: Record<string, string | number | null>) => Promise<void>;
  onPhotosChanged?: (hasPhotos: boolean) => void;
};

export function ActivityFeed({
  entityType,
  entityId,
  initialUpdates,
  hashtagFields,
  onHashtagUpdate,
  onPhotosChanged,
}: ActivityFeedProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState(initialUpdates);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isPending, startTransition] = useTransition();

  // File drag & drop
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const swapTopInputRef = useRef<HTMLInputElement>(null);
  const [swappingUpdateId, setSwappingUpdateId] = useState<string | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Attachment display: updateId -> Attachment[]
  const [attachmentsByUpdate, setAttachmentsByUpdate] = useState<
    Record<string, Attachment[]>
  >({});

  // Hashtag dropdown state
  const [showHashtag, setShowHashtag] = useState(false);
  const [hashtagFilter, setHashtagFilter] = useState("");
  const [hashtagIndex, setHashtagIndex] = useState(0);
  const [hashtagTriggerPos, setHashtagTriggerPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredFields = hashtagFields?.filter((f) =>
    f.label.toLowerCase().includes(hashtagFilter.toLowerCase()) ||
    f.key.toLowerCase().includes(hashtagFilter.toLowerCase())
  ) ?? [];

  const insertHashtag = useCallback((field: HashtagField) => {
    if (hashtagTriggerPos === null) return;
    const before = newContent.slice(0, hashtagTriggerPos);
    const after = newContent.slice(textareaRef.current?.selectionStart ?? hashtagTriggerPos);
    const inserted = `#${field.key} `;
    setNewContent(before + inserted + after);
    setShowHashtag(false);
    setHashtagFilter("");
    setHashtagTriggerPos(null);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = before.length + inserted.length;
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [hashtagTriggerPos, newContent]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewContent(val);

    if (!hashtagFields?.length) return;

    const textBeforeCursor = val.slice(0, cursorPos);
    const hashMatch = textBeforeCursor.match(/#(\w*)$/);

    if (hashMatch) {
      setShowHashtag(true);
      setHashtagFilter(hashMatch[1]);
      setHashtagTriggerPos(cursorPos - hashMatch[0].length);
      setHashtagIndex(0);
    } else {
      setShowHashtag(false);
      setHashtagFilter("");
      setHashtagTriggerPos(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showHashtag || filteredFields.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHashtagIndex((i) => Math.min(i + 1, filteredFields.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHashtagIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertHashtag(filteredFields[hashtagIndex]);
    } else if (e.key === "Escape") {
      setShowHashtag(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!showHashtag) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowHashtag(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showHashtag]);

  function parseHashtagValues(text: string): Record<string, string | number | null> {
    if (!hashtagFields?.length) return {};
    const fieldUpdates: Record<string, string | number | null> = {};

    for (const field of hashtagFields) {
      const regex = new RegExp(`#${field.key}\\s+(.+?)(?=\\s*#\\w|$)`, "gm");
      const match = regex.exec(text);
      if (match) {
        const rawValue = match[1].trim();
        if (rawValue) {
          if (field.type === "number") {
            const num = parseFloat(rawValue.replace(/[,$]/g, ""));
            if (!isNaN(num)) fieldUpdates[field.key] = num;
          } else {
            fieldUpdates[field.key] = rawValue;
          }
        }
      }
    }

    return fieldUpdates;
  }

  function scrollToBottom() {
    setTimeout(() => {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function handleAdd() {
    if (!newContent.trim()) return;
    startTransition(async () => {
      const fieldUpdates = parseHashtagValues(newContent);
      const hasFieldUpdates = Object.keys(fieldUpdates).length > 0;

      const result = await createUpdate({
        entity_type: entityType,
        entity_id: entityId,
        content: newContent.trim(),
      });

      if (result.success) {
        setUpdates((prev) => [
          ...prev,
          { ...result.data, author_name: user.name },
        ]);
        setNewContent("");
        scrollToBottom();

        if (hasFieldUpdates && onHashtagUpdate) {
          await onHashtagUpdate(fieldUpdates);
        }
      }
    });
  }

  // File upload handler
  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    console.log("[UPLOAD] handleFiles called with", fileArray.length, "files");
    if (fileArray.length === 0) return;

    setUploading(true);
    try {
      console.log("[UPLOAD] Creating update record...");
      const updateResult = await createUpdate({
        entity_type: entityType,
        entity_id: entityId,
        content: `[${fileArray.length} file${fileArray.length > 1 ? "s" : ""} attached]`,
      });

      console.log("[UPLOAD] createUpdate result:", JSON.stringify(updateResult));

      if (!updateResult.success) {
        alert("Could not create note: " + updateResult.error);
        return;
      }

      const updateId = updateResult.data.id;
      const uploaded: Attachment[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        console.log("[UPLOAD] Uploading file:", file.name, file.size, "bytes");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("updateId", updateId);
        formData.append("entityType", entityType);
        formData.append("entityId", entityId);

        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        console.log("[UPLOAD] API response status:", res.status);
        const text = await res.text();
        console.log("[UPLOAD] API response body:", text);

        let json;
        try {
          json = JSON.parse(text);
        } catch {
          errors.push(`${file.name}: Server returned non-JSON response (${res.status})`);
          continue;
        }

        if (json.success) {
          uploaded.push(json.data as Attachment);
          console.log("[UPLOAD] File uploaded successfully:", file.name);
        } else {
          errors.push(`${file.name}: ${json.error}`);
          console.log("[UPLOAD] File upload failed:", file.name, json.error);
        }
      }

      console.log("[UPLOAD] Total uploaded:", uploaded.length, "errors:", errors.length);

      if (uploaded.length === 0) {
        await deleteUpdate(updateId);
        alert("File upload failed:\n" + errors.join("\n"));
        return;
      }

      setUpdates((prev) => [
        ...prev,
        { ...updateResult.data, author_name: user.name },
      ]);

      setAttachmentsByUpdate((prev) => ({
        ...prev,
        [updateId]: uploaded,
      }));

      scrollToBottom();

      // Notify parent if any uploaded files are photos
      if (onPhotosChanged && uploaded.some((a) => a.file_type?.startsWith("image/"))) {
        onPhotosChanged(true);
      }

      if (errors.length > 0) {
        alert(`Some files failed to upload:\n${errors.join("\n")}`);
      }
    } catch (err) {
      console.error("[UPLOAD] Caught error:", err);
      alert("File upload error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  // Load attachments for an update on demand
  async function loadAttachments(updateId: string) {
    if (attachmentsByUpdate[updateId]) return;
    const result = await listAttachments(updateId);
    if (result.success) {
      setAttachmentsByUpdate((prev) => ({
        ...prev,
        [updateId]: result.data,
      }));
    }
  }

  async function handleDownload(attachmentId: string) {
    const result = await getDownloadUrl(attachmentId);
    if (result.success) {
      window.open(result.data, "_blank");
    }
  }

  async function handleDeleteAttachment(attachmentId: string, updateId: string) {
    const result = await deleteAttachment(attachmentId);
    if (result.success) {
      setAttachmentsByUpdate((prev) => ({
        ...prev,
        [updateId]: (prev[updateId] ?? []).filter((a) => a.id !== attachmentId),
      }));
    }
  }

  async function handleSwapAll(updateId: string, files: FileList) {
    // Delete all existing attachments for this update
    const existing = attachmentsByUpdate[updateId] ?? [];
    for (const att of existing) {
      await deleteAttachment(att.id);
    }

    // Upload new files
    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateId", updateId);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const res = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });

      try {
        const json = await res.json();
        if (json.success) uploaded.push(json.data as Attachment);
      } catch {
        // skip failed uploads
      }
    }

    setAttachmentsByUpdate((prev) => ({
      ...prev,
      [updateId]: uploaded,
    }));

    if (onPhotosChanged && uploaded.some((a) => a.file_type?.startsWith("image/"))) {
      onPhotosChanged(true);
    }
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

  function renderContent(text: string) {
    if (!hashtagFields?.length) return text;
    const fieldKeys = hashtagFields.map((f) => f.key).join("|");
    const regex = new RegExp(`(#(?:${fieldKeys})\\s+.+?)(?=\\s*#(?:${fieldKeys})\\s|$)`, "g");
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <span key={match.index} className="font-bold text-green-600">
          {match[1]}
        </span>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  }

  const isFileNote = (content: string) =>
    /^\[\d+ files? attached\]$/.test(content);

  return (
    <div
      className="space-y-3"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-700">
          Notes
        </h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-neutral-400 hover:text-neutral-600"
        >
          {uploading ? "Uploading..." : "Attach files"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={swapTopInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (e.target.files && swappingUpdateId) {
              await handleSwapAll(swappingUpdateId, e.target.files);
              setSwappingUpdateId(null);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Drop zone overlay */}
      {isDragging && (
        <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 text-sm text-blue-600">
          Drop files here to attach
        </div>
      )}

      {/* Updates list (chronological: oldest first) */}
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
                  {isFileNote(update.content) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSwappingUpdateId(update.id);
                        swapTopInputRef.current?.click();
                      }}
                      className="hover:text-neutral-600"
                    >
                      Swap
                    </button>
                  ) : (
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
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(update.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-600"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
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
            ) : isFileNote(update.content) ? (
              <FileAttachments
                updateId={update.id}
                attachments={attachmentsByUpdate[update.id]}
                onLoad={() => loadAttachments(update.id)}
                onDownload={handleDownload}
              />
            ) : (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                {renderContent(update.content)}
              </p>
            )}
          </li>
        ))}
      </ul>

      {updates.length === 0 && (
        <p className="text-xs text-neutral-400">No notes yet</p>
      )}

      <div ref={feedEndRef} />

      {/* Add new update — at the bottom since notes are chronological */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a note"
          rows={1}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none"
        />
        {showHashtag && filteredFields.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-20 bottom-full mb-1 left-0 w-64 rounded-md border border-neutral-200 bg-white shadow-lg max-h-48 overflow-y-auto"
          >
            {filteredFields.map((field, i) => (
              <button
                key={field.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertHashtag(field);
                }}
                className={`w-full px-3 py-1.5 text-left text-sm border-b border-neutral-100 last:border-0 ${
                  i === hashtagIndex
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className="font-medium">#{field.key}</span>
                <span className="ml-2 text-xs text-neutral-400">
                  {field.label}
                </span>
              </button>
            ))}
          </div>
        )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newContent.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-30"
          title="Add note"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Helpers for file type detection
function isImage(fileType: string | null) {
  return !!fileType?.startsWith("image/");
}
function isAudio(fileType: string | null) {
  return !!fileType?.startsWith("audio/");
}
function isVideo(fileType: string | null) {
  return !!fileType?.startsWith("video/");
}
function isPdf(fileType: string | null) {
  return fileType === "application/pdf";
}

function FileTypeIcon({ fileType }: { fileType: string | null }) {
  if (isAudio(fileType)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-purple-500">
        <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
        <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
      </svg>
    );
  }
  if (isVideo(fileType)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-500">
        <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3A.75.75 0 0019 15.25v-10.5z" />
      </svg>
    );
  }
  if (isPdf(fileType)) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5 text-[#5F6368]"
        aria-hidden
      >
        <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
      </svg>
    );
  }
  // Generic document icon
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400">
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clipRule="evenodd" />
    </svg>
  );
}

// Sub-component for file attachments display
function FileAttachments({
  updateId,
  attachments,
  onLoad,
  onDownload,
}: {
  updateId: string;
  attachments?: Attachment[];
  onLoad: () => void;
  onDownload: (id: string) => void;
}) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    onLoad();
  }, [updateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load preview URLs for images
  useEffect(() => {
    if (!attachments) return;
    const images = attachments.filter((a) => isImage(a.file_type));
    if (images.length === 0) return;

    let cancelled = false;
    (async () => {
      const urls: Record<string, string> = {};
      for (const img of images) {
        if (imageUrls[img.id]) continue;
        const result = await getDownloadUrl(img.id);
        if (cancelled) return;
        if (result.success) urls[img.id] = result.data;
      }
      if (!cancelled && Object.keys(urls).length > 0) {
        setImageUrls((prev) => ({ ...prev, ...urls }));
      }
    })();
    return () => { cancelled = true; };
  }, [attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!attachments) {
    return <p className="text-xs text-neutral-400">Loading files...</p>;
  }

  if (attachments.length === 0) {
    return <p className="text-xs text-neutral-400">Files removed</p>;
  }

  const images = attachments.filter((a) => isImage(a.file_type));
  const nonImages = attachments.filter((a) => !isImage(a.file_type));

  return (
    <div className="space-y-2">
      {/* Image gallery */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((att) => (
            <div key={att.id} className="group relative">
              {imageUrls[att.id] ? (
                <button
                  type="button"
                  onClick={() => setLightbox(att.id)}
                  className="block"
                >
                  <img
                    src={imageUrls[att.id]}
                    alt={att.file_name}
                    className="h-20 w-20 rounded border border-neutral-200 object-cover hover:opacity-80 transition-opacity"
                  />
                </button>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border border-neutral-200 bg-neutral-50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-300 animate-pulse">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.72 14.72a.75.75 0 01-1.06 0L6.22 12.28a.75.75 0 00-1.06 0l-2.16 2.16zM14 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && imageUrls[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageUrls[lightbox]}
              alt="Preview"
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-700 shadow-lg text-lg leading-none hover:bg-neutral-100"
            >
              &times;
            </button>
            <button
              type="button"
              onClick={() => {
                const att = attachments?.find((a) => a.id === lightbox);
                if (att) onDownload(att.id);
              }}
              className="absolute bottom-3 right-3 rounded-md bg-white/90 px-3 py-1.5 text-xs text-neutral-700 shadow hover:bg-white"
            >
              Download
            </button>
          </div>
        </div>
      )}

      {/* Non-image files */}
      {nonImages.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-2 text-xs"
        >
          <button
            type="button"
            onClick={() => onDownload(att.id)}
            className="hover:opacity-70 transition-opacity"
            title={`Download ${att.file_name}`}
          >
            <FileTypeIcon fileType={att.file_type} />
          </button>
          <span className="text-neutral-600 break-all" style={{ fontSize: "0.65rem" }}>
            {att.file_name}
          </span>
          <span className="text-neutral-300">
            {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
