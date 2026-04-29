"use client";

import { useState, useTransition, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createUpdate, editUpdate, deleteUpdate } from "@/actions/updates";
import {
  listAttachments,
  getDownloadUrl,
  deleteAttachment,
  getUploadUrl,
  createAttachmentRecord,
} from "@/actions/attachments";
import type { Update, EntityType, Attachment } from "@/lib/types";
import { AI_SUMMARY_PREFIX } from "@/app/api/summarize/route";

type UpdateWithAuthor = Update & { author_name: string; author_role?: string; author_email?: string };

export type HashtagField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
  color?: "green" | "cyan" | "purple";
};

export type QuickAction =
  | { label: string; content: string; variant?: "default" | "yellow"; adminOnly?: boolean }
  | { label: string; onClick: () => void | Promise<void>; variant?: "default" | "yellow"; adminOnly?: boolean };

type ActivityFeedProps = {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  initialUpdates: UpdateWithAuthor[];
  hashtagFields?: HashtagField[];
  quickActions?: QuickAction[];
  onHashtagUpdate?: (updates: Record<string, string | number | boolean | null>) => Promise<void>;
  onPhotosChanged?: (hasPhotos: boolean) => void;
};

function stripEmojis(str: string) {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

export type ActivityFeedHandle = {
  pushUpdate: (update: Update) => void;
};

export const ActivityFeed = forwardRef<ActivityFeedHandle, ActivityFeedProps>(function ActivityFeed({
  entityType,
  entityId,
  entityName,
  initialUpdates,
  hashtagFields,
  quickActions,
  onHashtagUpdate,
  onPhotosChanged,
}: ActivityFeedProps, ref) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState(initialUpdates);

  useImperativeHandle(ref, () => ({
    pushUpdate: (update: Update) => {
      setUpdates((prev) => [
        ...prev,
        {
          ...update,
          author_name: user.name,
          author_role: user.role,
          author_email: user.email,
        },
      ]);
      setTimeout(() => scrollToBottom(), 0);
    },
  }), [user]);

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

  // Audio recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Attachment display: updateId -> Attachment[]
  const [attachmentsByUpdate, setAttachmentsByUpdate] = useState<
    Record<string, Attachment[]>
  >({});

  // AI summary state: tracks which update IDs have been summarized
  const [summarizedUpdateIds, setSummarizedUpdateIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const update of initialUpdates) {
      const markerMatch = update.content.match(/\[summary-of:([^\]]+)\]/);
      if (markerMatch) ids.add(markerMatch[1]);
    }
    return ids;
  });
  const [summarizing, setSummarizing] = useState<string | null>(null);

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

  // Warn before closing tab if there's unsaved text
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (newContent.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [newContent]);

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

  function parseHashtagValues(text: string): Record<string, string | number | boolean | null> {
    if (!hashtagFields?.length) return {};
    const fieldUpdates: Record<string, string | number | boolean | null> = {};

    for (const field of hashtagFields) {
      if (field.type === "boolean") {
        // Boolean fields: just check if #key appears anywhere in the text
        const boolRegex = new RegExp(`#${field.key}(?:\\s|$|[^a-zA-Z0-9_])`, "im");
        if (boolRegex.test(text)) {
          fieldUpdates[field.key] = true;
        }
        continue;
      }
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

  function datePrefix(): string {
    const now = new Date();
    return `${now.getMonth() + 1}.${now.getDate()} `;
  }

  function handleAdd() {
    if (!newContent.trim()) return;
    startTransition(async () => {
      const fieldUpdates = parseHashtagValues(newContent);
      const hasFieldUpdates = Object.keys(fieldUpdates).length > 0;

      const result = await createUpdate({
        entity_type: entityType,
        entity_id: entityId,
        content: datePrefix() + newContent.trim(),
      });

      if (result.success) {
        setUpdates((prev) => [
          ...prev,
          { ...result.data, author_name: user.name, author_role: user.role, author_email: user.email },
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

      const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB

      for (let fi = 0; fi < fileArray.length; fi++) {
        const file = fileArray[fi];
        const uniqueName = fileArray.length > 1 ? `${fi + 1}_${file.name}` : file.name;
        console.log("[UPLOAD] Uploading file:", uniqueName, file.size, "bytes");

        try {
          if (file.size > DIRECT_UPLOAD_THRESHOLD) {
            // Large files: upload directly to Supabase via signed URL
            const urlResult = await getUploadUrl(updateId, entityType, entityId, uniqueName, file.size);
            if (!urlResult.success) {
              errors.push(`${file.name}: ${urlResult.error}`);
              continue;
            }

            const uploadRes = await fetch(urlResult.data.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });

            if (!uploadRes.ok) {
              errors.push(`${file.name}: Upload failed (${uploadRes.status})`);
              continue;
            }

            const recordResult = await createAttachmentRecord(
              updateId, uniqueName, file.type || "application/octet-stream", file.size, urlResult.data.path
            );

            if (recordResult.success) {
              uploaded.push(recordResult.data);
              console.log("[UPLOAD] File uploaded successfully (direct):", file.name);
            } else {
              errors.push(`${file.name}: ${recordResult.error}`);
            }
          } else {
            // Small files: use API route (supports HEIC conversion)
            const renamedFile = new File([file], uniqueName, { type: file.type });
            const formData = new FormData();
            formData.append("file", renamedFile);
            formData.append("updateId", updateId);
            formData.append("entityType", entityType);
            formData.append("entityId", entityId);

            const res = await fetch("/api/attachments/upload", {
              method: "POST",
              body: formData,
            });

            const text = await res.text();
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
            }
          }
        } catch (e) {
          errors.push(`${file.name}: ${(e as Error).message}`);
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
        { ...updateResult.data, author_name: user.name, author_role: user.role, author_email: user.email },
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
      console.error("[UPLOAD] Caught error:", err, JSON.stringify(err));
      alert("File upload error: " + (err instanceof Error ? err.message : JSON.stringify(err)));
    } finally {
      setUploading(false);
    }
  }

  async function handleSummarize(attachmentId: string, sourceUpdateId: string) {
    if (summarizedUpdateIds.has(sourceUpdateId) || summarizing) return;
    setSummarizing(sourceUpdateId);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId,
          entityType,
          entityId,
          leadName: entityName,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const newUpdate = {
          ...json.data,
          author_name: user.name,
          author_role: user.role,
          author_email: user.email,
        };
        setUpdates((prev) => [...prev, newUpdate]);
        setSummarizedUpdateIds((prev) => new Set(prev).add(sourceUpdateId));
        scrollToBottom();

        // Process hashtags in the summary to update lead fields
        const fieldUpdates = parseHashtagValues(json.data.content);
        if (Object.keys(fieldUpdates).length > 0 && onHashtagUpdate) {
          await onHashtagUpdate(fieldUpdates);
        }
      } else {
        alert("Could not summarize: " + json.error);
      }
    } catch (err) {
      alert("Summarize failed: " + (err as Error).message);
    } finally {
      setSummarizing(null);
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
    // Copy files immediately — browser clears dataTransfer after the event
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
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

  async function toggleRecording() {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordSeconds(0);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        // Build filename: M.DD Name (strip emojis)
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const cleanName = entityName ? stripEmojis(entityName) : "Recording";
        const fileName = `${month}.${day} ${cleanName}.webm`;

        const file = new File([blob], fileName, { type: "audio/webm" });
        await handleFiles([file]);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert("Could not access microphone. Please allow microphone access.");
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

  // Renders date stamp (e.g. "3.24") at start of text as bold
  function renderDateStamp(content: React.ReactNode, text: string): React.ReactNode {
    const dateMatch = text.match(/^(\d{1,2}\.\d{1,2})\s/);
    if (!dateMatch) return content;
    const stamp = dateMatch[1];
    // Get the text after the date stamp, split into lines
    const afterDate = text.slice(stamp.length).trim();
    const lines = afterDate.split("\n").filter((l) => l.trim());

    return (
      <div className="flex gap-2">
        <span className="font-bold text-neutral-800 shrink-0 pt-px">{stamp}</span>
        <div className="flex-1 min-w-0">
          {lines.map((line, i) => {
            const rendered = renderContent(line.trim());
            return (
              <div key={i} className="flex gap-1.5">
                <span className="text-white shrink-0 select-none">•</span>
                <span className="flex-1">{rendered}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderContent(text: string) {
    if (!hashtagFields?.length) return text;

    // Build color map from field definitions
    const fieldColorMap = new Map<string, string>();
    for (const f of hashtagFields) {
      fieldColorMap.set(f.key.toLowerCase(), f.color || "green");
    }

    const COLOR_CLASSES: Record<string, string> = {
      green: "text-[#6b7a2e] decoration-[#6b7a2e]/40",
      cyan: "text-cyan-500 decoration-cyan-500/40",
      purple: "text-purple-500 decoration-purple-500/40",
    };

    const booleanKeys = hashtagFields.filter((f) => f.type === "boolean").map((f) => f.key);
    const textKeys = hashtagFields.filter((f) => f.type !== "boolean").map((f) => f.key);
    const allKeys = hashtagFields.map((f) => f.key);

    // Build a combined regex that matches:
    // 1. Boolean hashtags: #key (standalone, no value needed)
    // 2. Text/number hashtags: #key followed by value
    const regexParts: string[] = [];
    if (booleanKeys.length > 0) {
      regexParts.push(`(#(?:${booleanKeys.join("|")}))(?=[\\s]|$)`);
    }
    if (textKeys.length > 0) {
      regexParts.push(`(#(?:${textKeys.join("|")})[\\t ]+[^\\n]+?)(?=[\\t ]*#(?:${allKeys.join("|")})(?:[\\t ]|$)|\\n|$)`);
    }
    if (regexParts.length === 0) return text;

    const regex = new RegExp(regexParts.join("|"), "gim");
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matched = (match[1] || match[2] || "").trim();
      if (!matched) continue;
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      // Extract the key from the matched hashtag
      const keyMatch = matched.match(/^#(\w+)/);
      const color = keyMatch ? (fieldColorMap.get(keyMatch[1].toLowerCase()) || "green") : "green";
      parts.push(
        <span key={match.index} className={`font-semibold underline ${COLOR_CLASSES[color]}`}>
          {matched}
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

  const isAiSummary = (content: string) =>
    content.startsWith("— AI Summary —");

  return (
    <div
      className="space-y-2"
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

      {/* Updates list (chronological: oldest first) */}
      <ul className="space-y-1.5">
        {updates.map((update) => (
          <li
            key={update.id}
            className="rounded border border-dashed px-2 py-1 border-neutral-200"
            style={
              isAiSummary(update.content)
                ? { backgroundColor: "rgba(255, 255, 255, 0.08)" }
                : update.author_email === "randy@btinvestments.co"
                  ? { backgroundColor: "rgba(138, 108, 0, 0.08)" }
                  : undefined
            }
          >
            <div className="flex items-center justify-between text-[0.5rem] text-neutral-400 mb-1">
              <span>
                {isAiSummary(update.content) ? <span className="font-bold text-white">*AI Summary*</span> : update.author_email === "randy@btinvestments.co" ? "Acquisitions Manager" : update.author_name} |{" "}
                <span className="font-bold text-white">{new Date(update.created_at).toLocaleString()}</span>
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
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }
                  }}
                  rows={2}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable resize-none overflow-hidden"
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
            ) : isAiSummary(update.content) ? (
              <div className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                {renderContent(
                  update.content
                    .replace(/^— AI Summary —\n\n/, "")
                    .replace(/\n\n\[summary-of:[^\]]+\]$/, "")
                )}
              </div>
            ) : isFileNote(update.content) ? (
              <FileAttachments
                updateId={update.id}
                attachments={attachmentsByUpdate[update.id]}
                onLoad={() => loadAttachments(update.id)}
                onDownload={handleDownload}
                onSummarize={handleSummarize}
                summarizedUpdateIds={summarizedUpdateIds}
                summarizingUpdateId={summarizing}
              />
            ) : (
              <div className="text-sm text-neutral-700 whitespace-pre-wrap font-editable">
                {renderDateStamp(renderContent(update.content), update.content)}
              </div>
            )}
          </li>
        ))}
      </ul>

      {updates.length === 0 && (
        <p className="text-xs text-neutral-400">No notes yet</p>
      )}

      <div ref={feedEndRef} />

      {/* Drop zone overlay */}
      {isDragging && (
        <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50 text-sm text-blue-600">
          Drop files here to attach
        </div>
      )}

      {/* Add new update — at the bottom since notes are chronological */}
      <div className="flex items-start gap-1.5">
        <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={(e) => {
            handleTextChange(e);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="Add a note"
          rows={2}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable resize-none overflow-hidden"
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
        {entityName && (
          <div className="flex flex-col items-center shrink-0">
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                recording
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300 hover:text-neutral-700"
              }`}
              title={recording ? "Stop recording" : "Record audio"}
            >
              {recording ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            {recording && (
              <span className="text-[0.6rem] tabular-nums text-red-500 mt-0.5">
                {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      {quickActions && quickActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-0.5 -mb-1">
          <span className="text-[0.65rem] text-neutral-400">Quick Actions:</span>
          {quickActions.map((qa) => {
            if (qa.adminOnly && user.role !== "admin") return null;
            const yellow = qa.variant === "yellow";
            const cls = yellow
              ? "rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 text-[0.65rem] text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
              : "rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[0.65rem] text-neutral-500 hover:bg-neutral-150 disabled:opacity-50";
            return (
              <button
                key={qa.label}
                type="button"
                disabled={isPending}
                onClick={() => {
                  if ("onClick" in qa) {
                    startTransition(async () => {
                      await qa.onClick();
                    });
                    return;
                  }
                  startTransition(async () => {
                    const result = await createUpdate({
                      entity_type: entityType,
                      entity_id: entityId,
                      content: datePrefix() + qa.content,
                    });
                    if (result.success) {
                      setUpdates((prev) => [
                        ...prev,
                        { ...result.data, author_name: user.name, author_role: user.role, author_email: user.email },
                      ]);
                      scrollToBottom();
                    }
                  });
                }}
                className={cls}
              >
                {qa.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

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

function LightboxOverlay({
  src,
  onClose,
  onPrev,
  onNext,
  onDownload,
  counter,
}: {
  src: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onDownload: () => void;
  counter?: string;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Download button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDownload(); }}
        className="absolute top-4 right-14 text-white/70 hover:text-white transition-colors"
        title="Download"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Counter */}
      {counter && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
          {counter}
        </div>
      )}

      {/* Prev arrow */}
      {onPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {onNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Image */}
      <img
        src={src}
        alt=""
        className="max-h-[85vh] max-w-[90vw] rounded object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function FileTypeIcon({ fileType }: { fileType: string | null }) {
  if (isAudio(fileType)) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[1.35rem] w-[1.35rem] text-neutral-400">
        <path d="M10 3.75a.75.75 0 00-1.264-.546L4.703 7H3.167a.75.75 0 00-.7.48A6.985 6.985 0 002 10c0 .887.165 1.737.468 2.52.111.29.39.48.699.48h1.536l4.033 3.796A.75.75 0 0010 16.25V3.75zM15.95 5.05a.75.75 0 00-1.06 1.061 5.5 5.5 0 010 7.778.75.75 0 001.06 1.06 7 7 0 000-9.899z" />
        <path d="M13.829 7.172a.75.75 0 00-1.061 1.06 2.5 2.5 0 010 3.536.75.75 0 001.06 1.06 4 4 0 000-5.656z" />
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
        className="h-[1.35rem] w-[1.35rem] text-[#5F6368]"
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
  onSummarize,
  summarizedUpdateIds,
  summarizingUpdateId,
}: {
  updateId: string;
  attachments?: Attachment[];
  onLoad: () => void;
  onDownload: (id: string) => void;
  onSummarize?: (attachmentId: string, updateId: string) => void;
  summarizedUpdateIds?: Set<string>;
  summarizingUpdateId?: string | null;
}) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

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

      {/* Lightbox with prev/next navigation */}
      {lightbox && imageUrls[lightbox] && (() => {
        const currentIdx = images.findIndex((a) => a.id === lightbox);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx < images.length - 1;
        const goPrev = () => { if (hasPrev) setLightbox(images[currentIdx - 1].id); };
        const goNext = () => { if (hasNext) setLightbox(images[currentIdx + 1].id); };
        return (
          <LightboxOverlay
            src={imageUrls[lightbox]}
            onClose={() => setLightbox(null)}
            onPrev={hasPrev ? goPrev : undefined}
            onNext={hasNext ? goNext : undefined}
            onDownload={() => {
              const att = attachments?.find((a) => a.id === lightbox);
              if (att) onDownload(att.id);
            }}
            counter={images.length > 1 ? `${currentIdx + 1} / ${images.length}` : undefined}
          />
        );
      })()}

      {/* Non-image files */}
      {nonImages.map((att) => (
        <div key={att.id} className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={async () => {
                if (isAudio(att.file_type)) {
                  if (playingAudioId === att.id) {
                    setPlayingAudioId(null);
                    return;
                  }
                  if (!audioUrls[att.id]) {
                    const result = await getDownloadUrl(att.id);
                    if (result.success) {
                      setAudioUrls((prev) => ({ ...prev, [att.id]: result.data }));
                    } else {
                      onDownload(att.id);
                      return;
                    }
                  }
                  setPlayingAudioId(att.id);
                } else {
                  onDownload(att.id);
                }
              }}
              className="hover:opacity-70 transition-opacity"
              title={isAudio(att.file_type) ? `Play ${att.file_name}` : `Download ${att.file_name}`}
            >
              <FileTypeIcon fileType={att.file_type} />
            </button>
            <span className="text-neutral-300 break-all text-xs">
              {att.file_name}
            </span>
            <span className="text-neutral-600" style={{ fontSize: "0.65rem" }}>
              {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ""}
            </span>
            {isAudio(att.file_type) && onSummarize && (
              <button
                type="button"
                onClick={() => onSummarize(att.id, updateId)}
                disabled={summarizedUpdateIds?.has(updateId) || summarizingUpdateId === updateId}
                className={`ml-auto shrink-0 rounded border px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${
                  summarizedUpdateIds?.has(updateId)
                    ? "border-neutral-200 text-neutral-300 cursor-default"
                    : summarizingUpdateId === updateId
                      ? "border-neutral-300 text-neutral-400 cursor-wait"
                      : "border-neutral-300 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                }`}
              >
                {summarizedUpdateIds?.has(updateId)
                  ? "Summarized"
                  : summarizingUpdateId === updateId
                    ? "Summarizing..."
                    : "Summarize"}
              </button>
            )}
          </div>
          {playingAudioId === att.id && audioUrls[att.id] && (
            <audio
              src={audioUrls[att.id]}
              controls
              autoPlay
              className="w-full h-8"
              onEnded={() => setPlayingAudioId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
