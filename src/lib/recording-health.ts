// Call-recording integrity (Aldo's lost call, 8/17).
//
// What happened: a 5:06 recording arrived as a 70 KB webm with a correct
// duration header and essentially no audio. 70 KB over 306 s is 1.9
// kbit/s - Opus's discontinuous-transmission rate for SILENCE, against
// ~130 kbit/s for the good recording made a minute later. So the
// recorder ran the whole call and captured silence: microphone held by
// another app (he was recording a phone call), which leaves the track
// live-but-muted. getUserMedia resolves, MediaRecorder runs, the on
// screen timer counts, and nothing is heard.
//
// The user learned about it only at summarize time, minutes later, via
// "Transcription returned empty result" - a message pointing at the
// wrong system entirely, long after the call was recoverable.
//
// These checks are pure so they can be unit-tested against the real
// numbers from both files; the browser-side monitor in
// recording-monitor.ts feeds them.

/**
 * Below this, a webm/opus stream carries no speech. Opus silence
 * (DTX) sits near 2 kbit/s = 250 B/s; real speech at MediaRecorder
 * defaults runs 6-16 KB/s. 1500 B/s (12 kbit/s) sits an order of
 * magnitude under any real capture and well above the silence floor,
 * so it separates the two cases without guessing at a device's bitrate.
 */
export const MIN_BYTES_PER_SECOND = 1500

/** Ignore blips: a 2-second clip is not worth judging on bitrate. */
export const MIN_ASSESSABLE_SECONDS = 3

export type RecordingVerdict = {
  /** False when the recording should not be trusted as captured audio. */
  ok: boolean
  /** 'empty' = nothing at all; 'silent' = full length, no audio. */
  problem: 'empty' | 'silent' | null
  bytesPerSecond: number
  /** User-facing sentence, written for the moment of STOP - when the
   *  call may still be recoverable - not for a later failure. */
  message: string | null
}

export function assessRecording(bytes: number, seconds: number): RecordingVerdict {
  const bps = seconds > 0 ? bytes / seconds : 0

  if (bytes === 0) {
    return {
      ok: false,
      problem: 'empty',
      bytesPerSecond: 0,
      message:
        'Nothing was captured - this recording is empty. Check that no other app (phone, Zoom, Meet) is holding the microphone, then record again.',
    }
  }

  // Too short to judge by bitrate; a real 2-second note is legitimate.
  if (seconds < MIN_ASSESSABLE_SECONDS) {
    return { ok: true, problem: null, bytesPerSecond: bps, message: null }
  }

  if (bps < MIN_BYTES_PER_SECOND) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    const length = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    return {
      ok: false,
      problem: 'silent',
      bytesPerSecond: bps,
      message:
        `This ${length} recording contains almost no audio - the microphone was live but silent. ` +
        'Another app (phone, Zoom, Meet) may have been holding it. The recording was saved, but it will not transcribe.',
    }
  }

  return { ok: true, problem: null, bytesPerSecond: bps, message: null }
}

/**
 * Live-monitor verdict: what share of sampled moments had no detectable
 * audio. Distinct from the bitrate check because it can fire DURING the
 * call - the only version of this warning that can save the call.
 */
export function assessSilenceRatio(silentSamples: number, totalSamples: number): {
  mostlySilent: boolean
  ratio: number
} {
  if (totalSamples === 0) return { mostlySilent: false, ratio: 0 }
  const ratio = silentSamples / totalSamples
  // 95%: normal speech has pauses, and a quiet room between sentences is
  // not a failure. Total silence is.
  return { mostlySilent: ratio >= 0.95, ratio }
}
