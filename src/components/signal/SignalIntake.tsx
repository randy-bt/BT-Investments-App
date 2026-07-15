"use client";

/**
 * Signal intake experience (handoffs 001 + 004 + 005): the /signal front door.
 *
 * Faithful implementation of the approved design reference
 * (SIGNAL/design/signal-universe.html): voice-first chooser (Talk it out /
 * Type it out), the recorder panel, the composer, and the two-step contact
 * flow, with exact copy and motion. Where the reference simulates (voice
 * capture, submission), this is real: MediaRecorder with a 20-minute
 * multi-note system, direct-to-storage uploads via signed URLs, then
 * POST /api/signal/submit which emails Randy and fires the Meta pixel
 * conversion events (handoff 003).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trackSignalSubmission } from "./MetaPixel";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_VOICE_SECONDS = 20 * 60; // per note; at the cap the note SAVES (handoff 004)
const MAX_VOICE_NOTES = 10;

type Attachment =
  | { kind: "voice"; blob: Blob; mime: string; durationSeconds: number }
  | { kind: "image"; file: File; previewUrl: string }
  | { kind: "file"; file: File };

type CurrentNote = {
  blob: Blob;
  mime: string;
  durationSeconds: number;
  url: string;
  wave: number[];
};

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function truncateName(name: string, max: number): string {
  return name.length > max ? name.slice(0, max - 3) + "…" : name;
}

// Safari records audio/mp4; Chrome/Firefox prefer webm+opus (handoff 004).
function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

const MicSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
  </svg>
);
const CamSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8a2 2 0 0 1 2-2h1.5l1.2-1.8A2 2 0 0 1 9.4 3h5.2a2 2 0 0 1 1.7 1.2L17.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const ClipSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export default function SignalIntake() {
  // ---- top-level flow ----
  const [view, setView] = useState<"chooser" | "voice" | "type">("chooser");
  const [chooserGone, setChooserGone] = useState(false);
  const [chooserHidden, setChooserHidden] = useState(false);
  const [swrapOpen, setSwrapOpen] = useState(false);
  const [stage, setStage] = useState<"compose" | "contact" | "done">("compose");
  // Transition classes mirror the reference's out/in choreography.
  const [stage1Out, setStage1Out] = useState(false);
  const [stage1Hidden, setStage1Hidden] = useState(false);
  const [stage2Shown, setStage2Shown] = useState(false);
  const [stage2In, setStage2In] = useState(false);

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [contact, setContact] = useState({ name: "", business: "", email: "", phone: "" });
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  // ---- voice panel state (handoff 004) ----
  const [recState, setRecState] = useState<"ready" | "recording" | "review">("ready");
  const [vprompt, setVprompt] = useState("Ready when you are.");
  const [vhint, setVhint] = useState("Tap to record. You can add photos and files after.");
  const [micDenied, setMicDenied] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [currentNote, setCurrentNote] = useState<CurrentNote | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0); // seconds into the note under review
  const [liveBars, setLiveBars] = useState<{ delay: string; dur: string }[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef = useRef(0);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recHitCapRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLSpanElement | null>(null);
  const scrubbingRef = useRef(false);
  const playRafRef = useRef(0);

  const swrapRef = useRef<HTMLDivElement>(null);
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

  // Auto-grow textarea (reference behavior, 300px cap)
  const autoGrow = useCallback(() => {
    const el = txtRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 300) + "px";
  }, []);

  // Live waveform bars: random delays/durations, generated client-side once
  // (the reference builds 26 <i> the same way).
  useEffect(() => {
    setLiveBars(
      Array.from({ length: 26 }, () => ({
        delay: (Math.random() * -0.9).toFixed(2) + "s",
        dur: (0.55 + Math.random() * 0.6).toFixed(2) + "s",
      }))
    );
  }, []);

  // Cleanup timers/streams/URLs on unmount
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (errTimerRef.current) clearTimeout(errTimerRef.current);
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const voiceCount = attachments.filter((a) => a.kind === "voice").length;
  const nonVoiceCount = attachments.filter((a) => a.kind !== "voice").length;
  const hasContent = message.trim().length > 0 || attachments.length > 0;

  // ---- the choice: talk it out or type it out ----
  function openPanel(which: "voice" | "type") {
    setErr("");
    setChooserGone(true);
    setTimeout(() => {
      setChooserHidden(true);
      setSwrapOpen(true);
      setView(which);
      requestAnimationFrame(() => {
        swrapRef.current?.animate(
          [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }],
          { duration: 450, easing: "cubic-bezier(.22,.9,.24,1)" }
        );
      });
      if (which === "type") setTimeout(() => txtRef.current?.focus(), 140);
    }, 300);
  }

  function backToChooser() {
    if (recState === "recording") stopRecording(false);
    setErr("");
    setSwrapOpen(false);
    setChooserHidden(false);
    requestAnimationFrame(() => setChooserGone(false));
  }

  // ---- voice recording (real MediaRecorder behind the reference's UI) ----
  async function startRecording() {
    if (voiceCount >= MAX_VOICE_NOTES) {
      flashErr(`Up to ${MAX_VOICE_NOTES} voice notes per submission.`);
      return;
    }
    let stream: MediaStream;
    try {
      // Mic permission is requested only here, on the record tap.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicDenied(true);
      return;
    }
    setMicDenied(false);
    recStreamRef.current = stream;
    const mime = pickRecordingMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setMicDenied(true);
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
      stream.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
      if (blob.size > 0) {
        setCurrentNote({
          blob,
          mime: type,
          durationSeconds: duration,
          url: URL.createObjectURL(blob),
          wave: Array.from({ length: 34 }, () => 4 + Math.round(Math.random() * 14)),
        });
        setRecState("review");
        setVprompt(
          recHitCapRef.current
            ? "That's the 20 minute mark, so we saved this note. Add another if there's more."
            : "Got it. Add photos if they help tell the story."
        );
      } else {
        setRecState("ready");
        setVprompt("Ready when you are.");
      }
    };
    recorderRef.current = recorder;
    recSecondsRef.current = 0;
    recHitCapRef.current = false;
    setRecSeconds(0);
    setRecState("recording");
    setVprompt("We're listening. Take your time.");
    setVhint("Tap again when you're done. Up to 20 minutes.");
    recorder.start();
    recTimerRef.current = setInterval(() => {
      recSecondsRef.current += 1;
      setRecSeconds(recSecondsRef.current);
      // At the cap the note saves, never discards (handoff 004).
      if (recSecondsRef.current >= MAX_VOICE_SECONDS) stopRecording(true);
    }, 1000);
  }

  function stopRecording(hitCap: boolean) {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    recHitCapRef.current = hitCap;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
    setVhint("Tap to record. You can add photos and files after.");
  }

  function toRecordState(msg: string) {
    if (currentNote) URL.revokeObjectURL(currentNote.url);
    setCurrentNote(null);
    setPlaying(false);
    setPlayPos(0);
    setRecSeconds(0);
    setRecState("ready");
    setVprompt(msg);
    setVhint("Tap to record. You can add photos and files after.");
  }

  function fileCurrentNote(): number {
    // Files the note under review as an attachment chip; returns new count.
    if (!currentNote) return voiceCount;
    const note = currentNote;
    URL.revokeObjectURL(note.url);
    setAttachments((prev) => [
      ...prev,
      { kind: "voice", blob: note.blob, mime: note.mime, durationSeconds: note.durationSeconds },
    ]);
    setCurrentNote(null);
    setPlaying(false);
    setPlayPos(0);
    return voiceCount + 1;
  }

  function addAnother() {
    const n = fileCurrentNote();
    setRecState("ready");
    setVprompt(`Note ${n} saved. Whenever you're ready for the next one.`);
    setVhint("Tap to record. You can add photos and files after.");
  }

  function togglePlayback() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => flashErr("Playback failed. Re-record if it keeps happening."));
    }
  }

  // ---- waveform scrubbing (handoff 009) ----
  // Chrome's MediaRecorder writes webm blobs whose <audio> duration reads
  // Infinity until the element has visited the end once; the recording
  // timer's count is the reliable fallback for the seek math.
  function noteDuration(): number {
    const el = audioRef.current;
    if (el && isFinite(el.duration) && el.duration > 0) return el.duration;
    return currentNote?.durationSeconds ?? 0;
  }

  function seekToPointer(e: React.PointerEvent) {
    const el = audioRef.current;
    const wave = waveRef.current;
    const dur = noteDuration();
    if (!el || !wave || !dur) return;
    const r = wave.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const t = ratio * dur;
    try {
      el.currentTime = t;
    } catch {
      /* not seekable yet; the position state still previews the target */
    }
    setPlayPos(t);
  }

  function waveDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety; the drag still works via pointermove */
    }
    scrubbingRef.current = true;
    seekToPointer(e);
  }
  function waveMove(e: React.PointerEvent) {
    if (scrubbingRef.current) seekToPointer(e);
  }
  function waveUp() {
    scrubbingRef.current = false;
  }

  // Smooth progress fill while playing (timeupdate alone is ~4Hz).
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const el = audioRef.current;
      if (el && !scrubbingRef.current) setPlayPos(el.currentTime);
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playRafRef.current);
  }, [playing]);

  // ---- attachments ----
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

  // ---- stage transitions (reference timing) ----
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

  function voiceSend() {
    if (!currentNote && voiceCount === 0) {
      flashErr("Record it first. Even twenty seconds helps.");
      return;
    }
    if (recState === "recording") stopRecording(false);
    fileCurrentNote();
    setErr("");
    setStage("contact");
    setStage2Shown(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setStage2In(true))
    );
    setTimeout(() => nameRef.current?.focus(), 260);
  }

  function goBack() {
    setErr("");
    setStage("compose");
    setStage2In(false);
    setTimeout(() => {
      setStage2Shown(false);
      if (view === "type") {
        setStage1Hidden(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setStage1Out(false))
        );
      }
    }, 420);
  }

  // ---- submit: upload attachments direct to storage, then submit ----
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

      let voiceN = 0;
      for (const att of attachments) {
        const isVoice = att.kind === "voice";
        const payload: Blob = isVoice ? att.blob : att.file;
        const mime = isVoice ? att.mime : att.file.type || "application/octet-stream";
        if (isVoice) voiceN++;
        const name = isVoice
          ? `Voice note ${voiceN}.${mime.includes("mp4") ? "m4a" : "webm"}`
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

      // Confirmed 200: the "Got it." state renders now, so the conversion
      // events fire now, exactly once (handoff 003).
      trackSignalSubmission();
      setStage("done");
    } catch (e) {
      flashErr((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // ---- shared chip row ----
  const chips =
    attachments.length > 0 ? (
      <div className="sig-chips">
        {attachments.map((att, i) => {
          const voiceIndex =
            att.kind === "voice"
              ? attachments.slice(0, i + 1).filter((a) => a.kind === "voice").length
              : 0;
          return (
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
                  Voice note {voiceIndex} &middot; {fmtTime(att.durationSeconds)}
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
              <button type="button" aria-label="Remove" onClick={() => removeAttachment(i)}>
                &#x2715;
              </button>
            </span>
          );
        })}
      </div>
    ) : null;

  // Optional written detail under a recorded note (handoff 009). Bound to
  // the SAME message state the type panel uses, so it rides the submission
  // as message_text and survives switching between panels.
  const voiceAddText = (
    <textarea
      className="sig-vaddtext"
      rows={2}
      placeholder="Anything you want to add in writing?"
      aria-label="Add written detail (optional)"
      value={message}
      onChange={(e) => setMessage(e.target.value)}
    />
  );

  const fileInputs = (
    <>
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
    </>
  );

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
        <p className="sig-isub sig-rise sig-r3">Whatever your business needs.</p>

        {stage !== "done" ? (
          <div style={{ width: "100%" }}>
            {/* The choice: voice leads, typing is the quiet second door */}
            {!chooserHidden && (
              <div className={`sig-chooser${chooserGone ? " gone" : ""}`}>
                <div className="sig-chbtns">
                  <button
                    className="sig-choice sig-cvoice"
                    type="button"
                    onClick={() => openPanel("voice")}
                    onAnimationEnd={(e) => e.currentTarget.classList.add("landed")}
                  >
                    <span className="sig-bico">{MicSvg}</span>
                    <span className="sig-ctxt">
                      <span className="sig-clbl">Talk it out</span>
                      <span className="sig-csml">Tell us what your business needs.</span>
                    </span>
                  </button>
                  <button
                    className="sig-choice sig-ctype"
                    type="button"
                    onClick={() => openPanel("type")}
                    onAnimationEnd={(e) => e.currentTarget.classList.add("landed")}
                  >
                    <span className="sig-bico">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                    <span className="sig-ctxt">
                      <span className="sig-clbl">Type it out</span>
                      <span className="sig-csml">Write it in a few sentences.</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div
              id="sig-swrap"
              ref={swrapRef}
              data-origin={view === "chooser" ? "type" : view}
              className={`sig-swrap${swrapOpen ? " open" : ""}`}
            >
              {/* Voice panel (handoff 004: real capture behind the reference UI) */}
              {view === "voice" && stage === "compose" && (
                <div className="sig-vstage">
                  <div className="sig-composer">
                    <button type="button" className="sig-back" onClick={backToChooser}>
                      &larr; back
                    </button>
                    <div className="sig-prompt">{vprompt}</div>
                    <div className="sig-vmain">
                      {recState !== "review" ? (
                        <div className={`sig-vrec${recState === "recording" ? " rec" : ""}`}>
                          <button
                            className="sig-recbtn"
                            type="button"
                            aria-label="Start or stop recording"
                            onClick={() =>
                              recState === "recording" ? stopRecording(false) : startRecording()
                            }
                          >
                            {MicSvg}
                          </button>
                          <div className="sig-vwave">
                            {liveBars.map((b, i) => (
                              <i
                                key={i}
                                style={{ animationDelay: b.delay, animationDuration: b.dur }}
                              />
                            ))}
                          </div>
                          <div className="sig-vtimer">{fmtTime(recSeconds)}</div>
                          {micDenied ? (
                            <button
                              type="button"
                              className="sig-vredo"
                              onClick={() => openPanel("type")}
                            >
                              Your browser blocked the mic. Type it out instead?
                            </button>
                          ) : (
                            <div className="sig-vhint">{vhint}</div>
                          )}
                        </div>
                      ) : (
                        <div className="sig-vreview">
                          <div className="sig-vclip">
                            <button
                              className="sig-vplay"
                              type="button"
                              aria-label={playing ? "Pause recording" : "Play recording"}
                              onClick={togglePlayback}
                            >
                              {playing ? (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                            <span
                              ref={waveRef}
                              className={`sig-clipwave${playPos > 0 || playing ? " seek" : ""}`}
                              role="slider"
                              aria-label="Seek within the recording"
                              aria-valuemin={0}
                              aria-valuemax={Math.round(noteDuration())}
                              aria-valuenow={Math.round(playPos)}
                              onPointerDown={waveDown}
                              onPointerMove={waveMove}
                              onPointerUp={waveUp}
                              onPointerCancel={waveUp}
                            >
                              {currentNote?.wave.map((h, i) => {
                                const dur = noteDuration();
                                const played =
                                  dur > 0 &&
                                  i < (playPos / dur) * (currentNote?.wave.length ?? 1);
                                return (
                                  <i
                                    key={i}
                                    className={played ? "on" : undefined}
                                    style={{ height: h }}
                                  />
                                );
                              })}
                            </span>
                            <span className="sig-vlen">
                              {playing || playPos > 0
                                ? fmtTime(playPos)
                                : fmtTime(currentNote?.durationSeconds ?? 0)}
                            </span>
                            <span className="sig-vacts">
                              <button
                                className="sig-vredo"
                                type="button"
                                onClick={() => toRecordState("Ready when you are.")}
                              >
                                Re-record
                              </button>
                              <button className="sig-vredo" type="button" onClick={addAnother}>
                                + Add another
                              </button>
                            </span>
                            {currentNote && (
                              <audio
                                ref={audioRef}
                                src={currentNote.url}
                                preload="metadata"
                                onPlay={() => setPlaying(true)}
                                onPause={() => setPlaying(false)}
                                onEnded={() => {
                                  setPlaying(false);
                                  setPlayPos(0);
                                }}
                                onLoadedMetadata={(e) => {
                                  // Materialize a real duration for Chrome's
                                  // Infinity-duration MediaRecorder webm so
                                  // seeking works across the whole note.
                                  const el = e.currentTarget;
                                  if (el.duration === Infinity) {
                                    const fix = () => {
                                      el.removeEventListener("timeupdate", fix);
                                      el.currentTime = 0;
                                    };
                                    el.addEventListener("timeupdate", fix);
                                    el.currentTime = 1e10;
                                  }
                                }}
                                hidden
                              />
                            )}
                          </div>
                          {chips}
                          {voiceAddText}
                          <div className="sig-tools">
                            <button
                              className="sig-tool"
                              type="button"
                              aria-label="Add a photo"
                              title="Add a photo"
                              onClick={() => imgInputRef.current?.click()}
                            >
                              {CamSvg}
                            </button>
                            <button
                              className="sig-tool"
                              type="button"
                              aria-label="Attach a file"
                              title="Attach a file"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {ClipSvg}
                            </button>
                            {fileInputs}
                          </div>
                          <button className="sig-cta" type="button" onClick={voiceSend}>
                            Send it, see what we&rsquo;d build
                          </button>
                        </div>
                      )}
                      {recState !== "review" && chips}
                      {recState === "ready" && voiceCount > 0 && voiceAddText}
                    </div>
                  </div>
                  <div className="sig-disarm" style={{ maxWidth: "52ch" }}>
                    Just talk. Describe your business and the problem you want gone. We&rsquo;ll
                    take it from there.
                  </div>
                </div>
              )}

              {/* Type panel: the composer (handoff 001, unchanged flow) */}
              {view === "type" && !stage1Hidden && (
                <div className={`sig-stage1${stage1Out ? " sig-out" : ""}`}>
                  <div className="sig-stage">
                    <div className="sig-composer">
                      <button type="button" className="sig-back" onClick={backToChooser}>
                        &larr; back
                      </button>
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
                      {chips}
                      <div className="sig-tools">
                        <button
                          className="sig-tool"
                          type="button"
                          aria-label="Record a voice note"
                          title="Record a voice note"
                          onClick={() => openPanel("voice")}
                        >
                          {MicSvg}
                        </button>
                        <button
                          className="sig-tool"
                          type="button"
                          aria-label="Add a photo"
                          title="Add a photo"
                          onClick={() => imgInputRef.current?.click()}
                        >
                          {CamSvg}
                        </button>
                        <button
                          className="sig-tool"
                          type="button"
                          aria-label="Attach a file"
                          title="Attach a file"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {ClipSvg}
                        </button>
                        {fileInputs}
                      </div>
                      <button className="sig-cta" type="button" onClick={goToContact}>
                        Send it, see what we&rsquo;d build
                      </button>
                    </div>
                    <div className="sig-disarm">
                      Talking&rsquo;s easier. Hit the mic and ramble. We&rsquo;ll figure out the
                      rest. That&rsquo;s the whole point of us.
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 2: contact card */}
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
