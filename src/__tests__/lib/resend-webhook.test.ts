import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifySvixSignature, parseResendEvent, isHardBounce } from '@/lib/resend-webhook'

const SECRET_BYTES = Buffer.from('test-secret-material-1234567890ab')
const SECRET = 'whsec_' + SECRET_BYTES.toString('base64')

function sign(payload: string, id: string, timestamp: string, secretBytes = SECRET_BYTES): string {
  return 'v1,' + createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${payload}`).digest('base64')
}

describe('verifySvixSignature', () => {
  const payload = '{"type":"email.delivered"}'
  const id = 'msg_123'
  const now = 1_800_000_000

  it('accepts a correctly signed payload within tolerance', () => {
    const timestamp = String(now)
    expect(
      verifySvixSignature({
        secret: SECRET, payload, id, timestamp,
        signature: sign(payload, id, timestamp),
        nowSeconds: now + 60,
      }),
    ).toBe(true)
  })

  it('accepts when any of several space-separated signatures match', () => {
    const timestamp = String(now)
    const good = sign(payload, id, timestamp)
    expect(
      verifySvixSignature({
        secret: SECRET, payload, id, timestamp,
        signature: `v1,${Buffer.from('garbage-signature-here-000000000').toString('base64')} ${good}`,
        nowSeconds: now,
      }),
    ).toBe(true)
  })

  it('rejects a tampered payload', () => {
    const timestamp = String(now)
    expect(
      verifySvixSignature({
        secret: SECRET, payload: payload + 'x', id, timestamp,
        signature: sign(payload, id, timestamp),
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const timestamp = String(now)
    expect(
      verifySvixSignature({
        secret: SECRET, payload, id, timestamp,
        signature: sign(payload, id, timestamp, Buffer.from('a-different-secret-material-00')),
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it('rejects stale timestamps (replay window)', () => {
    const timestamp = String(now - 3600)
    expect(
      verifySvixSignature({
        secret: SECRET, payload, id, timestamp,
        signature: sign(payload, id, timestamp),
        nowSeconds: now,
      }),
    ).toBe(false)
  })

  it('rejects missing headers', () => {
    expect(
      verifySvixSignature({ secret: SECRET, payload, id: null, timestamp: '1', signature: 'v1,x' }),
    ).toBe(false)
  })
})

describe('parseResendEvent', () => {
  it('parses a bounced event with recipient and bounce details', () => {
    const event = parseResendEvent({
      type: 'email.bounced',
      created_at: '2026-07-24T10:00:00.000Z',
      data: {
        email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
        message_id: '<111-222-333@email.example.com>',
        to: ['Investor@Example.com'],
        bounce: { type: 'Permanent', subType: 'Suppressed', message: 'hard bounce history' },
      },
    })
    expect(event).toEqual({
      type: 'email.bounced',
      createdAt: '2026-07-24T10:00:00.000Z',
      emailId: '56761188-7520-42d8-8898-ff6fc54ce618',
      messageId: '<111-222-333@email.example.com>',
      to: ['investor@example.com'],
      bounceType: 'Permanent',
      bounceMessage: 'hard bounce history',
    })
  })

  it('parses a delivered event without bounce fields', () => {
    const event = parseResendEvent({
      type: 'email.delivered',
      created_at: '2026-07-24T10:00:00.000Z',
      data: { email_id: 'abc', to: ['a@b.com'] },
    })
    expect(event?.type).toBe('email.delivered')
    expect(event?.bounceType).toBeNull()
  })

  it('returns null for non-email events and junk', () => {
    expect(parseResendEvent({ type: 'contact.created', data: {} })).toBeNull()
    expect(parseResendEvent('nope')).toBeNull()
    expect(parseResendEvent(null)).toBeNull()
  })
})

describe('isHardBounce', () => {
  it('Permanent is hard; Temporary and unknown are not', () => {
    expect(isHardBounce('Permanent')).toBe(true)
    expect(isHardBounce('permanent')).toBe(true)
    expect(isHardBounce('Temporary')).toBe(false)
    expect(isHardBounce(null)).toBe(false)
  })
})
