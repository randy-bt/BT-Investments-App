"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import {
  getRecordingUploadUrl,
  createOutreachRecording,
  deleteOutreachRecording,
  getRecordingDownloadUrl,
  sendRecordingToEntity,
  type OutreachRecording,
} from "@/actions/outreach-recordings";
import type { EntityLookup } from "@/actions/entity-lookup";

export function CallRecorder({
  initialRecordings,
  leads = [],
}: {
  initialRecordings: OutreachRecording[];
  leads?: EntityLookup[];
}) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [isPending, startTransition] = useTransition();

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Post-recording modal state
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState<"" | "agent" | "investor">("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Send to entity dropdown
  const [sendDropdownId, setSendDropdownId] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState("");
  const sendDropdownRef = useRef<HTMLDivElement>(null);

  // Send confirmation modal
  const [sendConfirm, setSendConfirm] = useState<{ recId: string; entity: EntityLookup } | null>(null);
  const [sending, setSending] = useState(false);

  // Playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const filteredEntities = leads.filter(
    (l) => l.name.toLowerCase().includes(entitySearch.toLowerCase())
  );

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordSeconds(0);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setPendingBlob(blob);
        setSaveName("");
        setSaveCategory("");
        setShowSaveModal(true);
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

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function handleSaveRecording() {
    if (!pendingBlob || !saveName.trim() || !saveCategory) return;
    setSaving(true);

    try {
      const now = new Date();
      const dateStamp = `${now.getMonth() + 1}.${now.getDate()}`;
      const catLabel = saveCategory === "agent" ? "Agent" : "Investor";
      const displayName = `${dateStamp} - ${saveName.trim()} - ${catLabel}`;
      const fileName = `${displayName}.webm`;

      const file = new File([pendingBlob], fileName, { type: "audio/webm" });

      const urlResult = await getRecordingUploadUrl(fileName, file.size);
      if (!urlResult.success) {
        alert("Could not save recording: " + urlResult.error);
        setSaving(false);
        return;
      }

      const uploadRes = await fetch(urlResult.data.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        alert("Could not upload recording. Please try again.");
        setSaving(false);
        return;
      }

      const recordResult = await createOutreachRecording(
        displayName,
        saveCategory,
        fileName,
        file.type,
        file.size,
        urlResult.data.path
      );

      if (!recordResult.success) {
        alert("Could not save recording: " + recordResult.error);
        setSaving(false);
        return;
      }

      setRecordings((prev) => [...prev, recordResult.data]);
      setShowSaveModal(false);
      setPendingBlob(null);
    } catch (err) {
      alert("Could not save recording: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteRecording() {
    setPendingBlob(null);
    setShowSaveModal(false);
  }

  function confirmDelete(id: string) {
    setDeleteTarget(id);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteOutreachRecording(id);
      if (result.success) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        if (playingId === id) setPlayingId(null);
      }
    });
  }

  async function handleDownload(rec: OutreachRecording) {
    const url = audioUrls[rec.id]
      ? audioUrls[rec.id]
      : await getRecordingDownloadUrl(rec.id).then((r) =>
          r.success ? r.data : null
        );
    if (!url) {
      alert("Could not download recording.");
      return;
    }
    if (!audioUrls[rec.id]) {
      setAudioUrls((prev) => ({ ...prev, [rec.id]: url }));
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = rec.file_name || `${rec.name}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function promptSendToEntity(recId: string, entity: EntityLookup) {
    setSendDropdownId(null);
    setEntitySearch("");
    setSendConfirm({ recId, entity });
  }

  async function handleConfirmSend() {
    if (!sendConfirm) return;
    setSending(true);

    const result = await sendRecordingToEntity(
      sendConfirm.recId,
      sendConfirm.entity.id,
      sendConfirm.entity.type
    );

    setSending(false);
    setSendConfirm(null);

    if (result.success) {
      alert(`Recording sent to ${sendConfirm.entity.name}'s record.`);
    } else {
      alert("Could not send recording: " + result.error);
    }
  }

  async function handleTogglePlay(id: string) {
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    if (!audioUrls[id]) {
      const result = await getRecordingDownloadUrl(id);
      if (result.success) {
        setAudioUrls((prev) => ({ ...prev, [id]: result.data }));
      } else {
        alert("Could not load recording: " + result.error);
        return;
      }
    }
    setPlayingId(id);
  }

  // Close modals/dropdowns on Escape and outside clicks
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (deleteTarget) setDeleteTarget(null);
        if (sendConfirm) setSendConfirm(null);
        if (sendDropdownId) { setSendDropdownId(null); setEntitySearch(""); }
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (sendDropdownId && sendDropdownRef.current && !sendDropdownRef.current.contains(e.target as Node)) {
        setSendDropdownId(null);
        setEntitySearch("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [deleteTarget, sendDropdownId, sendConfirm]);

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-3">
      <h2 className="text-sm font-medium text-neutral-700">Call Recordings</h2>

      {/* Record pill button — centered */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggleRecording}
          className={`rounded-full px-5 py-2 text-xs font-medium text-white transition-colors ${
            recording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          {recording ? "Stop Recording" : "Press to record a call"}
        </button>

        {recording && (
          <span className="text-sm tabular-nums text-red-500 animate-pulse">
            {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Save recording modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-neutral-800">Save Recording</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Who did you call?</label>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Contact name"
                  autoFocus
                  className="w-full rounded border border-neutral-200 px-3 py-2 text-sm font-editable placeholder:text-neutral-300 outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Category</label>
                <div className="relative">
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value as "" | "agent" | "investor")}
                    className={`w-full appearance-none rounded border border-neutral-200 px-3 pr-8 py-2 text-sm font-editable outline-none focus:border-neutral-400 ${
                      saveCategory === "" ? "text-neutral-300" : "text-neutral-700"
                    }`}
                  >
                    <option value="" disabled>Choose one</option>
                    <option value="agent">Agent</option>
                    <option value="investor">Investor</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleDeleteRecording}
                className="rounded px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                Delete Recording
              </button>
              <button
                type="button"
                onClick={handleSaveRecording}
                disabled={saving || !saveName.trim() || !saveCategory}
                className="rounded bg-neutral-800 px-4 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xs rounded-lg border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-neutral-800">Delete Recording</h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to delete this recording? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isPending}
                className="rounded bg-red-500 px-4 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send confirmation modal */}
      {sendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xs rounded-lg border border-neutral-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-neutral-800">Send Recording</h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to send this recording to <span className="font-semibold">{sendConfirm.entity.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSendConfirm(null)}
                className="rounded px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={sending}
                className="rounded bg-neutral-800 px-4 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recordings list */}
      {recordings.length > 0 && (
        <ul className="space-y-1">
          {recordings.map((rec) => (
            <li
              key={rec.id}
              className="rounded border border-dashed border-neutral-200 px-3 py-1.5"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTogglePlay(rec.id)}
                  className="flex items-center gap-2 text-sm text-neutral-700 hover:text-neutral-900 font-editable"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 text-neutral-400"
                  >
                    {playingId === rec.id ? (
                      <path fillRule="evenodd" d="M5.5 3a.5.5 0 01.5.5v13a.5.5 0 01-1 0v-13a.5.5 0 01.5-.5zm9 0a.5.5 0 01.5.5v13a.5.5 0 01-1 0v-13a.5.5 0 01.5-.5z" clipRule="evenodd" />
                    ) : (
                      <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
                    )}
                  </svg>
                  {rec.name}
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Send to lead */}
                  <div className="relative" ref={sendDropdownId === rec.id ? sendDropdownRef : undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        setSendDropdownId(sendDropdownId === rec.id ? null : rec.id);
                        setEntitySearch("");
                      }}
                      className="text-neutral-300 hover:text-neutral-600 transition-colors"
                      title="Send to record"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                    {sendDropdownId === rec.id && (
                      <div className="absolute right-0 top-6 z-40 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg">
                        <div className="p-2 border-b border-neutral-100">
                          <input
                            value={entitySearch}
                            onChange={(e) => setEntitySearch(e.target.value)}
                            placeholder="Search records..."
                            autoFocus
                            className="w-full rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-400 font-editable"
                          />
                        </div>
                        <ul className="max-h-40 overflow-y-auto">
                          {filteredEntities.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-neutral-400">No records found</li>
                          ) : (
                            filteredEntities.map((entity) => (
                              <li key={entity.id}>
                                <button
                                  type="button"
                                  onClick={() => promptSendToEntity(rec.id, entity)}
                                  className="w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 font-editable flex items-center justify-between"
                                >
                                  <span>{entity.name}</span>
                                  <span className="text-[10px] text-neutral-400">{entity.type === 'lead' ? 'Lead' : 'Investor'}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Download */}
                  <button
                    type="button"
                    onClick={() => handleDownload(rec)}
                    className="text-neutral-300 hover:text-neutral-600 transition-colors"
                    title="Download recording"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => confirmDelete(rec.id)}
                    disabled={isPending}
                    className="text-red-300 hover:text-red-500 disabled:opacity-50"
                    title="Delete recording"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.78.72l.5 6a.75.75 0 01-1.49.12l-.5-6a.75.75 0 01.71-.84zm3.62.72a.75.75 0 10-1.49-.12l-.5 6a.75.75 0 101.49.12l.5-6z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              {playingId === rec.id && audioUrls[rec.id] && (
                <audio
                  src={audioUrls[rec.id]}
                  controls
                  autoPlay
                  className="mt-1.5 w-full h-8"
                  onEnded={() => setPlayingId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {recordings.length === 0 && (
        <p className="text-xs text-neutral-400">No recordings yet</p>
      )}
    </div>
  );
}
