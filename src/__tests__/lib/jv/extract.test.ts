import { describe, it, expect } from 'vitest'
import { parseDealsJson } from '@/lib/jv/extract'

describe('parseDealsJson', () => {
  it('parses a clean JSON array', () => {
    const out = parseDealsJson('[{"address":"1 A St","asking_price":"$100k","needs_review":false}]')
    expect(out).toEqual([{ address: '1 A St', asking_price: '$100k', needs_review: false }])
  })
  it('tolerates code fences and surrounding prose', () => {
    const out = parseDealsJson('Here you go:\n```json\n[{"address":"2 B Ave","asking_price":null,"needs_review":true}]\n```')
    expect(out[0].address).toBe('2 B Ave')
    expect(out[0].needs_review).toBe(true)
  })
  it('returns [] for non-deal / garbage', () => {
    expect(parseDealsJson('not a deal')).toEqual([])
    expect(parseDealsJson('[]')).toEqual([])
  })
})
