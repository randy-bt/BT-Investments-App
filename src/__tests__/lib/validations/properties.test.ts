import { describe, it, expect } from 'vitest'
import { addPropertySchema } from '@/lib/validations/properties'

describe('addPropertySchema', () => {
  it('accepts valid property with just address', () => {
    const result = addPropertySchema.safeParse({
      address: '123 Main St, Phoenix, AZ 85001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects property without address', () => {
    const result = addPropertySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts all optional fields', () => {
    const result = addPropertySchema.safeParse({
      address: '123 Main St',
      apn: '123-45-678',
      year_built: 1995,
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 1800,
      lot_size: '0.25 acres',
      property_type: 'SFR',
    })
    expect(result.success).toBe(true)
  })
})
