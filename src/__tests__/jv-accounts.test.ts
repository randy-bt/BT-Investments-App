import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getJvAccounts } from '@/lib/jv/imap'

// JV senders reach more than one inbox (Randy 7/31), so the scanner reads a
// list of mailboxes. The suffix matters as much as the credentials: it is
// what keys each mailbox's watermark, and the first mailbox must keep the
// empty suffix or it rescans its entire history.

const KEYS = [
  'JV_IMAP_HOST', 'JV_IMAP_USER', 'JV_IMAP_PASSWORD',
  'JV_IMAP_HOST_2', 'JV_IMAP_USER_2', 'JV_IMAP_PASSWORD_2',
  'JV_IMAP_USER_3', 'JV_IMAP_PASSWORD_3',
]
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getJvAccounts', () => {
  it('returns the original mailbox with an empty suffix', () => {
    process.env.JV_IMAP_USER = 'deals@example.com'
    process.env.JV_IMAP_PASSWORD = 'secret'
    expect(getJvAccounts()).toEqual([
      { suffix: '', user: 'deals@example.com', pass: 'secret', host: 'imap.gmail.com' },
    ])
  })

  it('adds a second mailbox and keeps the first suffix empty', () => {
    process.env.JV_IMAP_USER = 'deals@example.com'
    process.env.JV_IMAP_PASSWORD = 'one'
    process.env.JV_IMAP_USER_2 = 'rentals@example.com'
    process.env.JV_IMAP_PASSWORD_2 = 'two'
    const accounts = getJvAccounts()
    expect(accounts.map((a) => [a.suffix, a.user])).toEqual([
      ['', 'deals@example.com'],
      ['_2', 'rentals@example.com'],
    ])
  })

  it('skips a half-configured mailbox rather than failing the whole scan', () => {
    process.env.JV_IMAP_USER = 'deals@example.com'
    process.env.JV_IMAP_PASSWORD = 'one'
    process.env.JV_IMAP_USER_2 = 'rentals@example.com' // password missing
    expect(getJvAccounts().map((a) => a.user)).toEqual(['deals@example.com'])
  })

  it('does not stop at a gap in the numbering', () => {
    process.env.JV_IMAP_USER = 'a@example.com'
    process.env.JV_IMAP_PASSWORD = 'one'
    process.env.JV_IMAP_USER_3 = 'c@example.com'
    process.env.JV_IMAP_PASSWORD_3 = 'three'
    expect(getJvAccounts().map((a) => a.suffix)).toEqual(['', '_3'])
  })

  it('shares the host unless a mailbox overrides it', () => {
    process.env.JV_IMAP_HOST = 'imap.fastmail.com'
    process.env.JV_IMAP_USER = 'a@example.com'
    process.env.JV_IMAP_PASSWORD = 'one'
    process.env.JV_IMAP_USER_2 = 'b@example.com'
    process.env.JV_IMAP_PASSWORD_2 = 'two'
    process.env.JV_IMAP_HOST_2 = 'imap.gmail.com'
    expect(getJvAccounts().map((a) => a.host)).toEqual(['imap.fastmail.com', 'imap.gmail.com'])
  })

  it('strips the literal trailing backslash-n Vercel sometimes stores', () => {
    process.env.JV_IMAP_USER = 'a@example.com\\n'
    process.env.JV_IMAP_PASSWORD = 'one\\n'
    const [a] = getJvAccounts()
    expect(a.user).toBe('a@example.com')
    expect(a.pass).toBe('one')
  })

  it('returns nothing when no mailbox is configured', () => {
    expect(getJvAccounts()).toEqual([])
  })
})
