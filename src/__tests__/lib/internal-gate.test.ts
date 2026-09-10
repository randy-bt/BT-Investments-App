import { describe, it, expect } from 'vitest'
import {
  mintInternalToken,
  verifyInternalToken,
  passwordMatches,
  safeNextPath,
  INTERNAL_MAX_AGE_SECONDS,
} from '@/lib/internal-gate'

const SECRET = 'test-secret-not-the-real-one'

describe('internal gate token', () => {
  it('accepts a token it just minted', async () => {
    const t = await mintInternalToken(SECRET)
    expect(await verifyInternalToken(t, SECRET)).toBe(true)
  })

  it('rejects a token signed with a DIFFERENT secret', async () => {
    const t = await mintInternalToken('other-secret')
    expect(await verifyInternalToken(t, SECRET)).toBe(false)
  })

  it('rejects a tampered expiry, even though the signature is otherwise real', async () => {
    const t = await mintInternalToken(SECRET)
    const [exp, sig] = t.split('.')
    const forged = `${Number(exp) + 60_000}.${sig}`
    expect(await verifyInternalToken(forged, SECRET)).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const t = await mintInternalToken(SECRET)
    const [exp, sig] = t.split('.')
    const flipped = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1)
    expect(await verifyInternalToken(`${exp}.${flipped}`, SECRET)).toBe(false)
  })

  it('rejects an expired token', async () => {
    const past = Date.now() - (INTERNAL_MAX_AGE_SECONDS + 60) * 1000
    const t = await mintInternalToken(SECRET, past)
    expect(await verifyInternalToken(t, SECRET)).toBe(false)
  })

  it('still accepts a token that has not quite expired', async () => {
    const almost = Date.now() - (INTERNAL_MAX_AGE_SECONDS - 60) * 1000
    const t = await mintInternalToken(SECRET, almost)
    expect(await verifyInternalToken(t, SECRET)).toBe(true)
  })

  it('FAILS CLOSED when the secret is unset, rather than opening the page', async () => {
    const t = await mintInternalToken(SECRET)
    expect(await verifyInternalToken(t, undefined)).toBe(false)
    expect(await verifyInternalToken(t, '')).toBe(false)
  })

  it('rejects junk without throwing', async () => {
    for (const junk of ['', 'nope', '.', 'abc.def', '123', '123.', '.abc', 'x.y.z']) {
      expect(await verifyInternalToken(junk, SECRET)).toBe(false)
    }
    expect(await verifyInternalToken(null, SECRET)).toBe(false)
    expect(await verifyInternalToken(undefined, SECRET)).toBe(false)
  })

  it('does not put the password anywhere in the token', async () => {
    const t = await mintInternalToken(SECRET)
    expect(t).not.toContain(SECRET)
  })
})

describe('passwordMatches', () => {
  it('matches the exact password', () => {
    expect(passwordMatches('bubba', 'bubba')).toBe(true)
  })
  it('rejects wrong, empty, case-variant and padded input', () => {
    expect(passwordMatches('Bubba', 'bubba')).toBe(false)
    expect(passwordMatches('bubba ', 'bubba')).toBe(false)
    expect(passwordMatches('', 'bubba')).toBe(false)
    expect(passwordMatches('bubbb', 'bubba')).toBe(false)
  })
  it('FAILS CLOSED when the expected password is unset', () => {
    expect(passwordMatches('bubba', undefined)).toBe(false)
    expect(passwordMatches('', undefined)).toBe(false)
    expect(passwordMatches('', '')).toBe(false)
  })
})

describe('safeNextPath', () => {
  it('keeps an /internal/ path', () => {
    expect(safeNextPath('/internal/tacoma-house')).toBe('/internal/tacoma-house')
  })
  it('refuses to open-redirect off-site or off-prefix', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/app/dashboard', '/', 'internal/x', null, undefined, '']) {
      expect(safeNextPath(bad)).toBe('/internal/tacoma-house')
    }
  })
})
