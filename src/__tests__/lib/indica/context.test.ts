import { describe, it, expect } from 'vitest'
import { buildEntityContext, type EntityContextInput } from '@/lib/indica/context'

const sampleInput: EntityContextInput = {
  entityType: 'lead',
  entity: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test Lead',
    fields: { asking_price: '$700,000', occupancy_status: 'owner', closing_date: null },
  },
  activity: [
    {
      id: 'u1',
      author_name: 'Randy',
      created_at: '2026-05-12T10:00:00Z',
      content: 'Initial cold call — seller motivated.',
    },
  ],
  attachments: [
    { id: 'a1', file_name: '5.12 Test Lead.m4a', file_type: 'audio/m4a' },
    { id: 'a2', file_name: 'photo.jpg', file_type: 'image/jpeg' },
  ],
  transcripts: [
    { attachment_id: 'a1', transcript_text: 'Seller said: We want to close fast.' },
  ],
  chatHistory: [
    { role: 'user', author_name: 'Randy', content: 'What did Thomas say about timeline?', created_at: '2026-06-01T12:00:00Z' },
    { role: 'assistant', author_name: null, content: 'Per the 5.12 call: he wants to close fast.', created_at: '2026-06-01T12:00:05Z' },
  ],
}

describe('buildEntityContext', () => {
  it('builds a text context containing the record fields', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.staticContext).toContain('Test Lead')
    expect(ctx.staticContext).toContain('$700,000')
    expect(ctx.staticContext).toContain('owner')
  })

  it('lists null fields as "(none)" rather than dropping them', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.staticContext).toMatch(/closing_date.*\(none\)/i)
  })

  it('includes the activity feed with authors and dates', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.staticContext).toContain('Randy')
    expect(ctx.staticContext).toContain('Initial cold call')
    expect(ctx.staticContext).toContain('2026-05-12')
  })

  it('lists attachments by file name', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.staticContext).toContain('5.12 Test Lead.m4a')
    expect(ctx.staticContext).toContain('photo.jpg')
  })

  it('inlines call transcripts with the source file name', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.staticContext).toContain('5.12 Test Lead.m4a')
    expect(ctx.staticContext).toContain('We want to close fast')
  })

  it('separates static context from chat history as cacheable boundary', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.chatMessages).toHaveLength(2)
    expect(ctx.chatMessages[0].role).toBe('user')
    expect(ctx.chatMessages[0].content).toContain('What did Thomas say')
    expect(ctx.chatMessages[1].role).toBe('assistant')
  })

  it('prefixes user messages with author name in the chat history (so Indica knows who said what)', () => {
    const ctx = buildEntityContext(sampleInput)
    expect(ctx.chatMessages[0].content.toLowerCase()).toContain('randy')
  })
})
