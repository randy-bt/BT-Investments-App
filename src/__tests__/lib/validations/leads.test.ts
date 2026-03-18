import { describe, it, expect } from 'vitest'
import { createLeadSchema, updateLeadSchema } from '@/lib/validations/leads'

describe('createLeadSchema', () => {
  it('accepts valid lead with required fields', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Motivated seller',
    })
    expect(result.success).toBe(true)
  })

  it('rejects lead without name', () => {
    const result = createLeadSchema.safeParse({
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lead without at least one phone', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects lead without at least one property', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = createLeadSchema.safeParse({
      name: 'John Doe',
      phones: [{ phone_number: '555-1234', is_primary: true }],
      properties: [{ address: '123 Main St' }],
      date_converted: '2026-01-15',
      source_campaign_name: 'Q1 Mailer',
      handoff_notes: 'Notes',
      mailing_address: '456 Oak Ave',
      asking_price: 250000,
      occupancy_status: 'Vacant',
      selling_timeline: '30 days',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateLeadSchema', () => {
  it('accepts partial updates', () => {
    const result = updateLeadSchema.safeParse({ name: 'Jane Doe' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = updateLeadSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
