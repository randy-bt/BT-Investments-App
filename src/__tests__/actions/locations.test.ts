import { describe, it, expect } from 'vitest'
import { createLocationSchema } from '@/lib/validations/locations'

describe('locations actions', () => {
  it('createLocationSchema validates input shape used by createLocation', () => {
    // The action delegates to createLocationSchema before insert. Sanity check.
    const valid = createLocationSchema.safeParse({ name: 'Olympia', kind: 'city', state_code: 'WA' })
    expect(valid.success).toBe(true)

    const invalid = createLocationSchema.safeParse({ name: '', kind: 'city' })
    expect(invalid.success).toBe(false)
  })
})
