import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanupTempDoc } from '@/lib/google-docs'
import type { drive_v3 } from 'googleapis'

// Regression guard for the Shared Drive cleanup failure found 9/5/2026.
//
// The service account is a CONTRIBUTOR on the Shared Drive. Contributors get
// canTrash but NOT canDelete, so files.delete 403s on every temp copy. The old
// code wrapped delete in an empty .catch, so 46 copies piled up between April
// and August while the code still looked correct. These tests pin the fallback
// and, just as importantly, that a total failure is LOUD.

const makeDrive = (opts: {
  deleteFails?: boolean
  trashFails?: boolean
}): { drive: drive_v3.Drive; calls: string[] } => {
  const calls: string[] = []
  const drive = {
    files: {
      delete: vi.fn(async () => {
        calls.push('delete')
        if (opts.deleteFails) throw new Error('403 insufficientFilePermissions')
        return {}
      }),
      update: vi.fn(async () => {
        calls.push('trash')
        if (opts.trashFails) throw new Error('403 cannot trash')
        return {}
      }),
    },
  } as unknown as drive_v3.Drive
  return { drive, calls }
}

afterEach(() => vi.restoreAllMocks())

describe('cleanupTempDoc', () => {
  it('deletes outright when permissions allow, and does not also trash', async () => {
    const { drive, calls } = makeDrive({})
    await cleanupTempDoc(drive, 'file-1')
    expect(calls).toEqual(['delete'])
  })

  it('falls back to trashing when delete is forbidden (the real production case)', async () => {
    const { drive, calls } = makeDrive({ deleteFails: true })
    await cleanupTempDoc(drive, 'file-2')
    expect(calls).toEqual(['delete', 'trash'])
  })

  it('logs loudly when BOTH fail, instead of swallowing it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { drive } = makeDrive({ deleteFails: true, trashFails: true })
    await cleanupTempDoc(drive, 'file-3')
    expect(err).toHaveBeenCalledOnce()
    // the file id has to be in the message or the log cannot be acted on
    expect(err.mock.calls[0][0]).toContain('file-3')
  })

  it('never throws, so a cleanup failure cannot fail the agreement', async () => {
    const { drive } = makeDrive({ deleteFails: true, trashFails: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(cleanupTempDoc(drive, 'file-4')).resolves.toBeUndefined()
  })
})
