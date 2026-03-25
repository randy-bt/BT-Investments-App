"use client";

import { useState, useRef, useTransition } from "react";
import {
  getRecordingUploadUrl,
  createOutreachRecording,
  deleteOutreachRecording,
  getRecordingDownloadUrl,
  type OutreachRecording,
} from "@/actions/outreach-recordings";

export function CallRecorder({
  initialRecordings,
}: {
  initialRecordings: OutreachRecording[];
}) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [callerName, setCallerName] = useState("");
  const [category, setCategory] = useState<"" | "agent" | "investor">("");

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const canRecord = callerName.trim() !== "" && category !== "";

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecordSeconds(0);

        try {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (blob.size === 0) return;

          const now = new Date();
          const dateStamp = `${now.getMonth() + 1}.${now.getDate()}`;
          const catLabel = category === "agent" ? "Agent" : "Investor";
          const displayName = `${dateStamp} - ${callerName.trim()} - ${catLabel}`;
          const fileName = `${displayName}.webm`;

          const file = new File([blob], fileName, { type: "audio/webm" });

          // Upload
          const urlResult = await getRecordingUploadUrl(fileName, file.size);
          if (!urlResult.success) {
            alert("Could not save recording: " + urlResult.error);
            return;
          }

          const uploadRes = await fetch(urlResult.data.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadRes.ok) {
            alert("Could not upload recording. Please try again.");
            return;
          }

          const recordResult = await createOutreachRecording(
            displayName,
            category as "agent" | "investor",
            fileName,
            file.type,
            file.size,
            urlResult.data.path
          );

          if (!recordResult.success) {
            alert("Could not save recording: " + recordResult.error);
            return;
          }

          setRecordings((prev) => [recordResult.data, ...prev]);
          setCallerName("");
          setCategory("");
        } catch (err) {
          alert("Could not save recording: " + (err as Error).message);
        }
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

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteOutreachRecording(id);
      if (result.success) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
      }
    });
  }

  // Track which recording is expanded for playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

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

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-3">
      <h2 className="text-sm font-medium text-neutral-700">Call Recordings</h2>

      {/* Record controls */}
      <div className="flex items-center gap-2">
        <input
          value={callerName}
          onChange={(e) => setCallerName(e.target.value)}
          placeholder="Who are you calling?"
          disabled={recording}
          className="flex-[3] min-w-0 rounded border border-neutral-200 px-2.5 py-1.5 text-sm font-editable placeholder:text-neutral-300"
        />
        <div className="relative flex-[1.3] min-w-0">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "" | "agent" | "investor")}
            disabled={recording}
            className={`w-full appearance-none rounded border border-neutral-200 px-2 pr-7 py-1.5 text-sm font-editable ${
              category === "" ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            <option value="" disabled>
              Choose one
            </option>
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

        {/* Record button */}
        <button
          type="button"
          onClick={toggleRecording}
          disabled={!canRecord && !recording}
          className={`shrink-0 rounded-full h-8 w-8 flex items-center justify-center transition-colors ${
            recording
              ? "bg-red-500 hover:bg-red-600"
              : canRecord
              ? "bg-neutral-800 hover:bg-neutral-700"
              : "bg-neutral-200 cursor-not-allowed"
          }`}
          title={recording ? "Stop recording" : "Record"}
        >
          {recording ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              className="h-3.5 w-3.5"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              className="h-3.5 w-3.5"
            >
              <circle cx="12" cy="12" r="6" />
            </svg>
          )}
        </button>

        {recording && (
          <span className="text-[0.7rem] tabular-nums text-red-500 shrink-0">
            {Math.floor(recordSeconds / 60)}:
            {String(recordSeconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>

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
                <button
                  type="button"
                  onClick={() => handleDelete(rec.id)}
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
