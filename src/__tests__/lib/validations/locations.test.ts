import { describe, it, expect } from 'vitest'
import { createLocationSchema } from '@/lib/validations/locations'

describe('createLocationSchema', () => {
  it('accepts a valid city with parent', () => {
    const result = createLocationSchema.safeParse({
      name: 'Bellevue',
      kind: 'city',
      parent_id: '11111111-1111-1111-1111-111111111111',
      state_code: 'WA',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a region with no parent and no state', () => {
    const result = createLocationSchema.safeParse({
      name: 'Pacific Northwest',
      kind: 'region',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createLocationSchema.safeParse({
      name: '   ',
      kind: 'city',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown kind', () => {
    const result = createLocationSchema.safeParse({
      name: 'Bellevue',
      kind: 'town',
    })
    expect(result.success).toBe(false)
  })
})
