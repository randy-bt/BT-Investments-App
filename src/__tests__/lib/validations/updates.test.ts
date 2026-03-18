import { describe, it, expect } from 'vitest'
import { createUpdateSchema, editUpdateSchema } from '@/lib/validations/updates'

describe('createUpdateSchema', () => {
  it('accepts valid update for lead', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'lead',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '<p>Called seller, no answer.</p>',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid entity_type', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'property',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Note',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty content', () => {
    const result = createUpdateSchema.safeParse({
      entity_type: 'investor',
      entity_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('editUpdateSchema', () => {
  it('accepts valid edit', () => {
    const result = editUpdateSchema.safeParse({
      content: '<p>Updated note content</p>',
    })
    expect(result.success).toBe(true)
  })
})
