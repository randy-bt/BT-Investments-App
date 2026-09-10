// Password gate for /internal/* (Randy, Sept 2026).
//
// Deliberately NOT app auth: no Google login, no account, no user record.
// One shared password, entered once per browser, so Randy and Mikaela can
// open an internal page from any device without being members of anything.
//
// The cookie is never the password. It is a signed, expiring token, so
// reading the cookie off a device tells you nothing you could type into the
// form. Web Crypto (not node:crypto) because this has to verify inside
// proxy.ts as well as in the route handler.

export const INTERNAL_COOKIE = 'bt_internal'
export const INTERNAL_MAX_AGE_SECONDS = 90 * 24 * 60 * 60 // 90 days

const encoder = new TextEncoder()

/** Payload we sign. Bumping the version invalidates every existing cookie. */
function payloadFor(exp: number): string {
  return `v1:${exp}`
}

async function keyFor(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Mint a token valid for INTERNAL_MAX_AGE_SECONDS. Returns `<exp>.<hmac>`. */
export async function mintInternalToken(secret: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + INTERNAL_MAX_AGE_SECONDS
  const key = await keyFor(secret, 'sign')
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadFor(exp)))
  return `${exp}.${toHex(sig)}`
}

/**
 * True only for a well-formed, unexpired, correctly-signed token.
 * Fails CLOSED on a missing secret: an unset env var must lock the page,
 * never open it.
 */
export async function verifyInternalToken(
  token: string | undefined | null,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false
  const dot = token.indexOf('.')
  if (dot < 1) return false

  const expRaw = token.slice(0, dot)
  const sigHex = token.slice(dot + 1)
  if (!/^\d+$/.test(expRaw)) return false

  const exp = Number(expRaw)
  if (!Number.isSafeInteger(exp) || exp * 1000 <= now) return false

  const sig = fromHex(sigHex)
  if (!sig) return false

  const key = await keyFor(secret, 'verify')
  // crypto.subtle.verify is constant-time, which is why we do not compare
  // hex strings ourselves.
  return crypto.subtle.verify('HMAC', key, sig as unknown as ArrayBuffer, encoder.encode(payloadFor(exp)))
}

/**
 * Constant-time password comparison. Length is allowed to leak (it always
 * does, via the response), but the contents must not.
 */
export function passwordMatches(supplied: string, expected: string | undefined): boolean {
  if (!expected) return false // unset env var locks the page rather than opening it
  const a = encoder.encode(supplied)
  const b = encoder.encode(expected)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Only allow returning to an /internal/ path, so ?next= cannot open-redirect. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/internal/tacoma-house'
  if (!next.startsWith('/internal/')) return '/internal/tacoma-house'
  if (next.startsWith('//')) return '/internal/tacoma-house'
  return next
}
