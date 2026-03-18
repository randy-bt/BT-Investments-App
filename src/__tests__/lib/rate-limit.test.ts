import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '@/lib/rate-limit'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(3, 60000) // 3 requests per minute
  })

  it('allows requests under the limit', () => {
    expect(limiter.check('1.2.3.4')).toBe(true)
    expect(limiter.check('1.2.3.4')).toBe(true)
    expect(limiter.check('1.2.3.4')).toBe(true)
  })

  it('blocks requests over the limit', () => {
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
  })

  it('tracks different IPs separately', () => {
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    expect(limiter.check('1.2.3.4')).toBe(false)
    expect(limiter.check('5.6.7.8')).toBe(true)
  })
})
