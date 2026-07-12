import { z } from 'zod'

// Limits for the Signal intake (handoffs 001 + 004). Attachments upload
// directly from the browser to storage via signed URLs (Vercel caps route
// bodies at ~4.5MB, so bytes never pass through the API); the submit route
// receives only the storage paths and re-verifies each object server-side.
export const SIGNAL_MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB per photo/file
// A 20-minute note at MediaRecorder's default audio bitrate stays well
// under this, with headroom for AAC on iOS.
export const SIGNAL_MAX_VOICE_BYTES = 40 * 1024 * 1024
export const SIGNAL_MAX_FILES = 5 // photos + files, excluding voice notes
export const SIGNAL_MAX_VOICE_SECONDS = 20 * 60 // per note (handoff 004)
export const SIGNAL_MAX_VOICE_NOTES = 10

export const SIGNAL_ATTACHMENT_KINDS = ['voice', 'image', 'file'] as const
export type SignalAttachmentKind = (typeof SIGNAL_ATTACHMENT_KINDS)[number]

export function signalMaxBytes(kind: SignalAttachmentKind): number {
  return kind === 'voice' ? SIGNAL_MAX_VOICE_BYTES : SIGNAL_MAX_FILE_BYTES
}

// Server-side mime allowlist. The camera button restricts to images and
// the mic to audio client-side; the paperclip is "any file", bounded here
// to common safe document/media types.
const IMAGE_MIMES = /^image\/(jpeg|png|gif|webp|heic|heif|avif|svg\+xml)$/
const AUDIO_MIMES = /^audio\/(webm|mp4|mpeg|aac|wav|ogg|x-m4a|m4a)(;.*)?$/
const FILE_MIMES =
  /^(application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|vnd\.ms-powerpoint|json|rtf)|text\/(plain|csv|markdown)|image\/.+|audio\/.+|video\/(mp4|quicktime|webm))(;.*)?$/

export function signalMimeAllowed(kind: SignalAttachmentKind, mime: string): boolean {
  if (kind === 'voice') return AUDIO_MIMES.test(mime)
  if (kind === 'image') return IMAGE_MIMES.test(mime)
  return FILE_MIMES.test(mime)
}

export const signalUploadRequestSchema = z
  .object({
    kind: z.enum(SIGNAL_ATTACHMENT_KINDS),
    mime: z.string().min(1).max(200),
    size: z.number().int().positive().max(SIGNAL_MAX_VOICE_BYTES),
    name: z.string().min(1).max(300),
  })
  .refine((v) => v.size <= signalMaxBytes(v.kind), {
    message: 'File is too large.',
  })

export const signalAttachmentSchema = z
  .object({
    kind: z.enum(SIGNAL_ATTACHMENT_KINDS),
    storage_path: z.string().min(1).max(500),
    mime: z.string().min(1).max(200),
    size: z.number().int().positive().max(SIGNAL_MAX_VOICE_BYTES),
    original_name: z.string().min(1).max(300),
    duration_seconds: z.number().int().positive().max(SIGNAL_MAX_VOICE_SECONDS).optional(),
  })
  .refine((v) => v.size <= signalMaxBytes(v.kind), {
    message: 'File is too large.',
  })

export const signalSubmissionSchema = z
  .object({
    message_text: z.string().max(10000).optional().default(''),
    name: z.string().max(200).optional().default(''),
    business_name: z.string().max(200).optional().default(''),
    email: z.string().email().max(320),
    phone: z.string().max(50).optional().default(''),
    attachments: z
      .array(signalAttachmentSchema)
      .max(SIGNAL_MAX_FILES + SIGNAL_MAX_VOICE_NOTES)
      .default([]),
  })
  .refine(
    (v) => v.message_text.trim().length > 0 || v.attachments.length > 0,
    { message: 'Tell us a little about it first: type, talk, or add a photo.' }
  )
  .refine(
    (v) => v.attachments.filter((a) => a.kind === 'voice').length <= SIGNAL_MAX_VOICE_NOTES,
    { message: `Up to ${SIGNAL_MAX_VOICE_NOTES} voice notes per submission.` }
  )
  .refine(
    (v) => v.attachments.filter((a) => a.kind !== 'voice').length <= SIGNAL_MAX_FILES,
    { message: `Up to ${SIGNAL_MAX_FILES} files per submission.` }
  )

export type SignalSubmissionInput = z.infer<typeof signalSubmissionSchema>
export type SignalAttachmentInput = z.infer<typeof signalAttachmentSchema>
