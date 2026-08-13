// How an attachment is announced in a feed (Randy 8/13, for ACQ2).
//
// The feed stores a placeholder line - "[1 file attached]" - and the real
// metadata lives in the `attachments` table. The main app fetches that and
// renders a proper list; ACQ2 never did, so on his phone a call recording
// read as literally "[1 file attached]" and told him nothing.
//
// Grounded in what is actually stored: of ~1,000 attachments, 906 are audio
// (webm/mpeg/m4a), 91 are images, and the rest are a handful of video and
// PDFs. So audio is the case worth getting right; everything else needs to
// degrade politely rather than be enumerated exhaustively.

export type AttachmentKind = 'audio' | 'image' | 'video' | 'pdf' | 'file'

export function attachmentKind(fileType: string | null | undefined, fileName?: string | null): AttachmentKind {
  const type = (fileType ?? '').toLowerCase()
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type === 'application/pdf') return 'pdf'

  // Fall back to the extension: file_type is nullable, and a few older rows
  // predate it being written.
  const ext = (fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  if (['webm', 'mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(ext)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'gif', 'heic', 'webp'].includes(ext)) return 'image'
  if (['mp4', 'mov', '3gp', 'm4v'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

const ICONS: Record<AttachmentKind, string> = {
  audio: '🎙',
  image: '🖼',
  video: '🎬',
  pdf: '📄',
  file: '📎',
}

const NOUNS: Record<AttachmentKind, [string, string]> = {
  audio: ['audio file', 'audio files'],
  image: ['photo', 'photos'],
  video: ['video', 'videos'],
  pdf: ['PDF', 'PDFs'],
  file: ['file', 'files'],
}

export function attachmentIcon(kind: AttachmentKind): string {
  return ICONS[kind]
}

export type AttachmentSummary = { icon: string; label: string; kind: AttachmentKind }

/**
 * One line describing a group of attachments: "🎙 1 audio file".
 *
 * A mixed group falls back to the generic noun rather than inventing a
 * compound ("2 audio files and 1 photo") - the filenames are listed
 * underneath anyway, so the summary only has to be honest, not exhaustive.
 */
export function summarizeAttachments(
  files: Array<{ file_type?: string | null; file_name?: string | null }>,
): AttachmentSummary | null {
  if (files.length === 0) return null
  const kinds = files.map((f) => attachmentKind(f.file_type, f.file_name))
  const allSame = kinds.every((k) => k === kinds[0])
  const kind: AttachmentKind = allSame ? kinds[0] : 'file'
  const [one, many] = NOUNS[kind]
  return {
    icon: ICONS[kind],
    kind,
    label: `${files.length} ${files.length === 1 ? one : many}`,
  }
}

/** "1.2 MB" / "840 KB". Null size renders nothing rather than "0 B". */
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
