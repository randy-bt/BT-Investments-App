import { describe, it, expect } from 'vitest'
import { createInvestorSchema, updateInvestorSchema } from '@/lib/validations/investors'

describe('createInvestorSchema', () => {
  it('accepts valid investor', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
      locations_of_interest: 'Phoenix AZ, Tucson AZ',
    })
    expect(result.success).toBe(true)
  })

  it('rejects investor without name', () => {
    const result = createInvestorSchema.safeParse({
      locations_of_interest: 'Phoenix AZ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects investor without locations', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createInvestorSchema.safeParse({
      name: 'Jane Smith',
      locations_of_interest: 'Phoenix AZ',
      company: 'Smith RE LLC',
      deals_notes: 'Interested in SFR under 200k',
    })
    expect(result.success).toBe(true)
  })
})
