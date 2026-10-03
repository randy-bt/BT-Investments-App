import { describe, it, expect } from 'vitest'
import { saveErrorMessage } from '@/lib/pending-recording'

// The one pure piece of the recovery feature: turning the framework's stale-
// tab error into an instruction. IndexedDB itself needs a browser and is
// exercised live.

describe('saveErrorMessage', () => {
  it("turns Next's stale-tab error into 'reload, your recording is kept'", () => {
    const e = new Error('Server Action "6041a590d3d1f95ec51c34d5dffac6cd8565696a6e" was not found on the server.\nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action')
    const m = saveErrorMessage(e)
    expect(m).toMatch(/just updated/i)
    expect(m).toMatch(/reload/i)
    expect(m).toMatch(/kept/i)
    expect(m).not.toMatch(/6041a590/) // the hash is noise to a person
  })
  it('matches the other wording Next uses for the same condition', () => {
    expect(saveErrorMessage(new Error('Failed to find Server Action "abc"'))).toMatch(/reload/i)
  })
  it('passes any other error through with context', () => {
    expect(saveErrorMessage(new Error('Storage quota exceeded'))).toBe('Could not save recording: Storage quota exceeded')
    expect(saveErrorMessage('plain string')).toBe('Could not save recording: plain string')
    expect(saveErrorMessage(undefined)).toBe('Could not save recording: unknown error')
  })
})
