import { createHmac, timingSafeEqual } from 'node:crypto'

// Resend webhook plumbing (spec 7/24). Resend signs webhooks with Svix:
// headers svix-id / svix-timestamp / svix-signature, secret "whsec_<b64>",
// signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`)).
// The signature header can hold several space-separated "v1,<b64>" entries
// (secret rotations); any match passes.

const TOLERANCE_SECONDS = 5 * 60

export function verifySvixSignature(opts: {
  secret: string
  payload: string
  id: string | null
  timestamp: string | null
  signature: string | null
  nowSeconds?: number
}): boolean {
  const { secret, payload, id, timestamp, signature } = opts
  if (!secret || !id || !timestamp || !signature) return false

  const ts = parseInt(timestamp, 10)
  if (!Number.isFinite(ts)) return false
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  if (secretBytes.length === 0) return false
  const expected = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest()

  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    const candidate = Buffer.from(sig, 'base64')
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return true
    }
  }
  return false
}

export type ResendEmailEvent = {
  type: string
  createdAt: string | null
  emailId: string | null
  messageId: string | null
  to: string[]
  bounceType: string | null
  bounceMessage: string | null
}

export function parseResendEvent(raw: unknown): ResendEmailEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.type !== 'string' || !obj.type.startsWith('email.')) return null
  const data = (obj.data ?? {}) as Record<string, unknown>
  const bounce = (data.bounce ?? {}) as Record<string, unknown>
  const to = Array.isArray(data.to)
    ? data.to.filter((t): t is string => typeof t === 'string').map((t) => t.trim().toLowerCase())
    : []
  return {
    type: obj.type,
    createdAt: typeof obj.created_at === 'string' ? obj.created_at : null,
    emailId: typeof data.email_id === 'string' ? data.email_id : null,
    messageId: typeof data.message_id === 'string' ? data.message_id : null,
    to,
    bounceType: typeof bounce.type === 'string' ? bounce.type : null,
    bounceMessage: typeof bounce.message === 'string' ? bounce.message : null,
  }
}

/** Resend classifies bounces as Permanent (hard) or Temporary (soft). */
export function isHardBounce(bounceType: string | null): boolean {
  return bounceType?.toLowerCase() === 'permanent'
}
