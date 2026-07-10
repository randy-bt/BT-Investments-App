"use client";

/**
 * Signal intake experience (handoff 001) — the /signal front door.
 *
 * Faithful implementation of the locked prototype
 * (SIGNAL/design/signal-design-system.html, "The intake experience"):
 * composer-first two-step flow, exact copy, exact motion. Where the
 * prototype simulated (voice recording, submission), this is real:
 * MediaRecorder for voice, direct-to-storage uploads via signed URLs,
 * then POST /api/signal/submit which emails Randy.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_VOICE_SECONDS = 5 * 60;

type Attachment =
  | { kind: "voice"; blob: Blob; mime: string; durationSeconds: number }
  | { kind: "image"; file: File; previewUrl: string }
  | { kind: "file"; file: File };

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function truncateName(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 3) + "…" : name;
}

// Safari records audio/mp4; Chrome/Firefox prefer webm+opus.
function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

export default function SignalIntake() {
  const [stage, setStage] = useState<"compose" | "contact" | "done">("compose");
  // Transition classes mirror the prototype's out/in choreography.
  const [stage1Out, setStage1Out] = useState(false);
  const [stage1Hidden, setStage1Hidden] = useState(false);
  const [stage2Shown, setStage2Shown] = useState(false);
  const [stage2In, setStage2In] = useState(false);

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [contact, setContact] = useState({ name: "", business: "", email: "", phone: "" });
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef = useRef(0);
  const recStreamRef = useRef<MediaStream | null>(null);

  const txtRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashErr = useCallback((m: string) => {
    setErr(m);
    if (errTimerRef.current) clearTimeout(errTimerRef.current);
    errTimerRef.current = setTimeout(() => {
      setErr((cur) => (cur === m ? "" : cur));
    }, 4000);
  }, []);

  // Auto-grow textarea (prototype behavior, 300px cap)
  const autoGrow = useCallback(() => {
    const el = txtRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 300) + "px";
  }, []);

  // Cleanup preview URLs + timers on unmount
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (errTimerRef.current) clearTimeout(errTimerRef.current);
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const hasVoice = attachments.some((a) => a.kind === "voice");
  const nonVoiceCount = attachments.filter((a) => a.kind !== "voice").length;
  const hasContent = message.trim().length > 0 || attachments.length > 0;

  // ---- Voice recording (MediaRecorder) ----
  async function startRecording() {
    if (hasVoice) {
      flashErr("One voice note per submission. Remove it to re-record.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      flashErr("We could not reach your microphone. Typing works just as well.");
      return;
    }
    recStreamRef.current = stream;
    const mime = pickRecordingMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      flashErr("Recording is not supported in this browser. Typing works just as well.");
      return;
    }
    recChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "audio/webm";
      const blob = new Blob(recChunksRef.current, { type });
      const duration = Math.max(1, recSecondsRef.current);
      if (blob.size > 0) {
        setAttachments((prev) => [
          ...prev,
          { kind: "voice", blob, mime: type, durationSeconds: duration },
        ]);
      }
      stream.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    };
    recorderRef.current = recorder;
    recSecondsRef.current = 0;
    setRecSeconds(0);
    setRecording(true);
    recorder.start();
    recTimerRef.current = setInterval(() => {
      recSecondsRef.current += 1;
      setRecSeconds(recSecondsRef.current);
      if (recSecondsRef.current >= MAX_VOICE_SECONDS) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }

  // ---- Attachments ----
  function addFiles(list: FileList | null, kind: "image" | "file") {
    if (!list) return;
    const incoming = [...list];
    let count = nonVoiceCount;
    for (const f of incoming) {
      if (count >= MAX_FILES) {
        flashErr(`Up to ${MAX_FILES} files per submission.`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        flashErr(`${truncateName(f.name, 24)} is too large (25MB max).`);
        continue;
      }
      if (kind === "image") {
        setAttachments((prev) => [
          ...prev,
          { kind: "image", file: f, previewUrl: URL.createObjectURL(f) },
        ]);
      } else {
        setAttachments((prev) => [...prev, { kind: "file", file: f }]);
      }
      count++;
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const att = prev[index];
      if (att?.kind === "image") URL.revokeObjectURL(att.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  // ---- Stage transitions (prototype timing: 380ms out, then in) ----
  function goToContact() {
    if (!hasContent) {
      flashErr("Tell us a little about it first: type, talk, or add a photo.");
      return;
    }
    setErr("");
    setStage("contact");
    setStage1Out(true);
    setTimeout(() => {
      setStage1Hidden(true);
      setStage2Shown(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setStage2In(true))
      );
      setTimeout(() => nameRef.current?.focus(), 260);
    }, 380);
  }

  function goBack() {
    setErr("");
    setStage("compose");
    setStage2In(false);
    setTimeout(() => {
      setStage2Shown(false);
      setStage1Hidden(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setStage1Out(false))
      );
    }, 420);
  }

  // ---- Submit: upload attachments direct to storage, then submit ----
  async function submit() {
    const email = contact.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      flashErr("Add your email so we can get back to you.");
      return;
    }
    if (sending) return;
    setSending(true);
    setErr("");
    try {
      const supabase = createClient();
      const uploaded: {
        kind: string;
        storage_path: string;
        mime: string;
        size: number;
        original_name: string;
        duration_seconds?: number;
      }[] = [];

      for (const att of attachments) {
        const isVoice = att.kind === "voice";
        const payload: Blob = isVoice ? att.blob : att.file;
        const mime = isVoice ? att.mime : att.file.type || "application/octet-stream";
        const name = isVoice
          ? `voice-note.${mime.includes("mp4") ? "m4a" : "webm"}`
          : att.file.name;

        const urlRes = await fetch("/api/signal/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: att.kind, mime, size: payload.size, name }),
        });
        const urlJson = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlJson.error || "Upload failed.");

        const { error: upErr } = await supabase.storage
          .from("signal-attachments")
          .uploadToSignedUrl(urlJson.path, urlJson.token, payload, { contentType: mime });
        if (upErr) throw new Error("Upload failed. Check your connection and try again.");

        uploaded.push({
          kind: att.kind,
          storage_path: urlJson.path,
          mime,
          size: payload.size,
          original_name: name,
          ...(isVoice ? { duration_seconds: att.durationSeconds } : {}),
        });
      }

      const res = await fetch("/api/signal/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_text: message,
          name: contact.name,
          business_name: contact.business,
          email,
          phone: contact.phone,
          attachments: uploaded,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");

      setStage("done");
    } catch (e) {
      flashErr((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="sig-scope">
      <div className="sig-inner">
        <div className="sig-eyebrow sig-rise sig-r1">
          <span className="sig-dot" />
          Signal
        </div>
        <h1 className="sig-display sig-rise sig-r2">
          Custom AI tools,
          <br />
          built for <em>your business</em>.
        </h1>
        <p className="sig-isub sig-rise sig-r3">
          Tell us what your business needs. We&rsquo;ll build it.
        </p>

        {stage !== "done" ? (
          <div style={{ width: "100%" }}>
            {/* Stage 1 — composer */}
            {!stage1Hidden && (
              <div className={`sig-stage1${stage1Out ? " sig-out" : ""}`}>
                <div className="sig-stage sig-rise sig-r4">
                  <div className="sig-composer">
                    <div className="sig-prompt">Tell us about it.</div>
                    <textarea
                      ref={txtRef}
                      rows={3}
                      aria-label="Describe what your business needs"
                      placeholder="What is it? The quotes, the scheduling, the follow-ups, the website you never got around to. Describe it however it comes out."
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        autoGrow();
                      }}
                    />
                    {attachments.length > 0 && (
                      <div className="sig-chips">
                        {attachments.map((att, i) => (
                          <span className="sig-chip" key={i}>
                            {att.kind === "voice" ? (
                              <>
                                <span className="sig-wave">
                                  <i style={{ height: 5 }} />
                                  <i style={{ height: 11 }} />
                                  <i style={{ height: 7 }} />
                                  <i style={{ height: 12 }} />
                                  <i style={{ height: 6 }} />
                                </span>
                                Voice note &middot; {fmtTime(att.durationSeconds)}
                              </>
                            ) : att.kind === "image" ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={att.previewUrl} alt="" />
                                {truncateName(att.file.name, 16)}
                              </>
                            ) : (
                              <>
                                <svg
                                  width="15"
                                  height="15"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#7a7770"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ flex: "0 0 auto" }}
                                >
                                  <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                {truncateName(att.file.name, 18)}
                              </>
                            )}
                            <button
                              type="button"
                              aria-label="Remove"
                              onClick={() => removeAttachment(i)}
                            >
                              &#x2715;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="sig-tools">
                      <button
                        className="sig-tool"
                        type="button"
                        aria-label="Record a voice note"
                        title="Record a voice note"
                        onClick={startRecording}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="2" width="6" height="12" rx="3" />
                          <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
                        </svg>
                      </button>
                      <button
                        className="sig-tool"
                        type="button"
                        aria-label="Add a photo"
                        title="Add a photo"
                        onClick={() => imgInputRef.current?.click()}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 8a2 2 0 0 1 2-2h1.5l1.2-1.8A2 2 0 0 1 9.4 3h5.2a2 2 0 0 1 1.7 1.2L17.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </button>
                      <button
                        className="sig-tool"
                        type="button"
                        aria-label="Attach a file"
                        title="Attach a file"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      </button>
                      <input
                        type="file"
                        ref={imgInputRef}
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => {
                          addFiles(e.target.files, "image");
                          e.target.value = "";
                        }}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        hidden
                        onChange={(e) => {
                          addFiles(e.target.files, "file");
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <button className="sig-cta" type="button" onClick={goToContact}>
                      Send it, see what we&rsquo;d build
                    </button>
                    <div className={`sig-rec${recording ? " sig-on" : ""}`} aria-live="polite">
                      <div className="sig-bars">
                        <i style={{ animationDelay: "0s" }} />
                        <i style={{ animationDelay: ".15s" }} />
                        <i style={{ animationDelay: ".3s" }} />
                        <i style={{ animationDelay: ".45s" }} />
                        <i style={{ animationDelay: ".6s" }} />
                        <i style={{ animationDelay: ".75s" }} />
                        <i style={{ animationDelay: ".9s" }} />
                      </div>
                      <div className="sig-time">{fmtTime(recSeconds)}</div>
                      <button className="sig-stop" type="button" onClick={stopRecording}>
                        Done talking
                      </button>
                    </div>
                  </div>
                  <div className="sig-disarm">
                    Talking&rsquo;s easier. Hit the mic and ramble. We&rsquo;ll figure out the
                    rest. That&rsquo;s the whole point of us.
                  </div>
                </div>
              </div>
            )}

            {/* Stage 2 — contact card */}
            <div
              className={`sig-stage2${stage2Shown ? " sig-shown" : ""}${stage2In ? " sig-in" : ""}`}
            >
              <div className="sig-composer sig-contact">
                <button
                  type="button"
                  className="sig-back"
                  aria-label="Back to your message"
                  onClick={goBack}
                >
                  &larr; back
                </button>
                <div className="sig-prompt">Last thing. Where do we reach you?</div>
                <div className="sig-grid2">
                  <input
                    ref={nameRef}
                    className="sig-field"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    value={contact.name}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  />
                  <input
                    className="sig-field"
                    type="text"
                    placeholder="Business name"
                    autoComplete="organization"
                    value={contact.business}
                    onChange={(e) => setContact({ ...contact, business: e.target.value })}
                  />
                  <input
                    className="sig-field"
                    type="email"
                    placeholder="Email"
                    autoComplete="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  />
                  <input
                    className="sig-field"
                    type="tel"
                    placeholder="Phone"
                    autoComplete="tel"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  />
                </div>
                <button className="sig-cta" type="button" disabled={sending} onClick={submit}>
                  {sending ? "Sending…" : "Send it"}
                </button>
              </div>
            </div>

            <div className="sig-err" aria-live="polite">
              {err}
            </div>
          </div>
        ) : (
          <div className="sig-done sig-on">
            <h3>Got it.</h3>
            <p>
              We&rsquo;ll look this over and be in touch soon. Keep an eye on your inbox.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
