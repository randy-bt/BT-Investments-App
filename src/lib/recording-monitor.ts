// Live capture monitor for call recordings (Aldo's lost call, 8/17).
//
// The failure it exists to catch: getUserMedia resolves, MediaRecorder
// runs, the timer counts, and the microphone is producing SILENCE the
// whole time because another app holds it. Nothing in the MediaRecorder
// API reports that - the stream is "live", it just carries nothing.
//
// So we listen to the audio itself. An AnalyserNode samples the signal
// four times a second; a track that is muted or ended, or a signal that
// never leaves the noise floor, raises a warning WHILE THE CALL IS
// HAPPENING, when the user can still call back or take notes.

import { assessSilenceRatio } from '@/lib/recording-health'

/** Time-domain bytes center on 128. A muted track reads exactly 128;
 *  a quiet room still dithers a few counts. 2 splits them. */
const SILENCE_AMPLITUDE = 2
const SAMPLE_MS = 250
/** Warn after this much unbroken silence from the start. Long enough
 *  that clearing your throat before speaking does not trip it, short
 *  enough to save a call. */
const SILENT_GRACE_MS = 8000

export type CaptureReport = {
  silentSamples: number
  totalSamples: number
  /** The track muted or ended mid-recording. */
  trackFailed: boolean
  mostlySilent: boolean
}

export class CaptureMonitor {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private analyser: AnalyserNode | null = null
  private buf: Uint8Array<ArrayBuffer> | null = null
  private silent = 0
  private total = 0
  private consecutiveSilent = 0
  private warned = false
  private trackFailed = false
  private track: MediaStreamTrack | null = null

  constructor(
    private stream: MediaStream,
    private onLiveProblem?: (message: string) => void,
  ) {
    this.track = stream.getAudioTracks()[0] ?? null

    // A track can arrive already muted when another app owns the mic.
    if (this.track) {
      if (this.track.muted) this.flagTrack('The microphone is muted or in use by another app.')
      this.track.addEventListener('mute', () =>
        this.flagTrack('The microphone went silent mid-recording (another app may have taken it).'),
      )
      this.track.addEventListener('ended', () =>
        this.flagTrack('The microphone disconnected mid-recording.'),
      )
    }

    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      // Autoplay policies can hand back a suspended context.
      void this.ctx.resume?.()
      const src = this.ctx.createMediaStreamSource(stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      src.connect(this.analyser)
      this.buf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
      this.timer = setInterval(() => this.sample(), SAMPLE_MS)
    } catch {
      // Monitoring is best-effort: if Web Audio is unavailable the
      // recording still happens and the stop-time bitrate check still
      // catches a silent file. Never block a call over telemetry.
      this.ctx = null
    }
  }

  private flagTrack(message: string) {
    this.trackFailed = true
    if (!this.warned) {
      this.warned = true
      this.onLiveProblem?.(message)
    }
  }

  private sample() {
    if (!this.analyser || !this.buf) return
    this.analyser.getByteTimeDomainData(this.buf)
    let peak = 0
    for (let i = 0; i < this.buf.length; i++) {
      const dev = Math.abs(this.buf[i] - 128)
      if (dev > peak) peak = dev
    }
    this.total++
    if (peak <= SILENCE_AMPLITUDE) {
      this.silent++
      this.consecutiveSilent++
      if (!this.warned && this.consecutiveSilent * SAMPLE_MS >= SILENT_GRACE_MS) {
        this.warned = true
        this.onLiveProblem?.(
          'No audio is reaching the recorder. Check that no other app (phone, Zoom, Meet) has the microphone.',
        )
      }
    } else {
      this.consecutiveSilent = 0
    }
  }

  stop(): CaptureReport {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    try {
      void this.ctx?.close()
    } catch {
      // context already closed
    }
    void this.stream
    return {
      silentSamples: this.silent,
      totalSamples: this.total,
      trackFailed: this.trackFailed,
      mostlySilent: assessSilenceRatio(this.silent, this.total).mostlySilent,
    }
  }
}
