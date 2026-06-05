import { describe, it, expect } from 'vitest'
import { DigestBodyJson, DIGEST_TOOL_INPUT_SCHEMA } from '@/lib/digest/schema'

const validSample = {
  lead: {
    title: 'OpenAI launches o4-mini',
    body: 'Available today in ChatGPT and the API. 80% lower input cost than o3.',
  },
  sections: [
    {
      name: 'AI',
      items: [
        { subject: 'Anthropic', detail: 'raises $5B at $80B valuation, led by Lightspeed.' },
      ],
    },
  ],
}

describe('DigestBodyJson schema', () => {
  it('accepts a valid sample', () => {
    expect(DigestBodyJson.safeParse(validSample).success).toBe(true)
  })

  it('accepts lead = null', () => {
    expect(DigestBodyJson.safeParse({ ...validSample, lead: null }).success).toBe(true)
  })

  it('rejects an unknown section name', () => {
    const bad = {
      ...validSample,
      sections: [{ name: 'Sports', items: validSample.sections[0].items }],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects an empty items array', () => {
    const bad = {
      ...validSample,
      sections: [{ name: 'AI', items: [] }],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects empty subject string', () => {
    const bad = {
      ...validSample,
      sections: [
        { name: 'AI', items: [{ subject: '', detail: 'x' }] },
      ],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects missing lead key entirely', () => {
    const { lead, ...rest } = validSample
    void lead
    expect(DigestBodyJson.safeParse(rest).success).toBe(false)
  })

  it('exports a tool input schema with the four section names', () => {
    const sectionEnum = (DIGEST_TOOL_INPUT_SCHEMA.properties.sections.items.properties.name as { enum: string[] }).enum
    expect(sectionEnum).toEqual(['AI', 'Tech & Business', 'Markets', 'Worth knowing'])
  })
})
