import { describe, it, expect } from 'vitest'
import {
  attachmentKind,
  summarizeAttachments,
  formatFileSize,
} from '@/lib/attachment-display'

// The mime types actually in the attachments table, by volume.
describe('attachmentKind', () => {
  it('classifies every audio type on file', () => {
    expect(attachmentKind('audio/webm')).toBe('audio')   // 626 rows
    expect(attachmentKind('audio/mpeg')).toBe('audio')   // 241 rows
    expect(attachmentKind('audio/x-m4a')).toBe('audio')  // 39 rows
  })

  it('classifies images, video and PDFs', () => {
    expect(attachmentKind('image/jpeg')).toBe('image')
    expect(attachmentKind('image/png')).toBe('image')
    expect(attachmentKind('video/3gpp')).toBe('video')
    expect(attachmentKind('application/pdf')).toBe('pdf')
  })

  // file_type is nullable, and older rows predate it.
  it('falls back to the extension when the type is missing', () => {
    expect(attachmentKind(null, '3.21 Joaquin Nene.webm')).toBe('audio')
    expect(attachmentKind(null, 'Paul Larson SS1 XXL.mp3')).toBe('audio')
    expect(attachmentKind('', '2.20 Susan Andersen.m4a')).toBe('audio')
    expect(attachmentKind(null, '2013 Survey.pdf')).toBe('pdf')
    expect(attachmentKind(null, '1_0.jpg')).toBe('image')
    expect(attachmentKind(null, 'clip.3GP')).toBe('video')
  })

  it('degrades to a generic file rather than guessing', () => {
    expect(attachmentKind(null, 'notes.xyz')).toBe('file')
    expect(attachmentKind(null, null)).toBe('file')
    expect(attachmentKind(undefined, undefined)).toBe('file')
  })
})

describe('summarizeAttachments', () => {
  const audio = { file_type: 'audio/webm', file_name: 'call.webm' }
  const photo = { file_type: 'image/jpeg', file_name: 'front.jpg' }

  // The line Randy was actually looking at: "[1 file attached]".
  it('turns one recording into "1 audio file"', () => {
    expect(summarizeAttachments([audio])).toEqual({
      icon: '🎙',
      kind: 'audio',
      label: '1 audio file',
    })
  })

  it('pluralizes', () => {
    expect(summarizeAttachments([audio, audio])?.label).toBe('2 audio files')
    expect(summarizeAttachments([photo, photo, photo])?.label).toBe('3 photos')
  })

  it('uses the right noun per kind', () => {
    expect(summarizeAttachments([photo])?.label).toBe('1 photo')
    expect(summarizeAttachments([{ file_type: 'application/pdf' }])?.label).toBe('1 PDF')
    expect(summarizeAttachments([{ file_type: 'video/3gpp' }])?.label).toBe('1 video')
  })

  // Honest rather than exhaustive — the filenames are listed underneath.
  it('falls back to the generic noun for a mixed group', () => {
    const mixed = summarizeAttachments([audio, photo])
    expect(mixed?.kind).toBe('file')
    expect(mixed?.label).toBe('2 files')
    expect(mixed?.icon).toBe('📎')
  })

  it('returns null when there is nothing to announce', () => {
    expect(summarizeAttachments([])).toBeNull()
  })
})

describe('formatFileSize', () => {
  it('scales B / KB / MB', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(860_000)).toBe('840 KB')
    expect(formatFileSize(1_258_291)).toBe('1.2 MB')
  })

  // Null size renders nothing rather than a misleading "0 B".
  it('returns null for missing or nonsense sizes', () => {
    expect(formatFileSize(null)).toBeNull()
    expect(formatFileSize(undefined)).toBeNull()
    expect(formatFileSize(-1)).toBeNull()
    expect(formatFileSize(Number.NaN)).toBeNull()
  })

  it('shows a genuine zero-byte file as 0 B', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })
})
