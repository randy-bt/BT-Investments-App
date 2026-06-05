import { describe, it, expect } from 'vitest'
import { bodyJsonToText } from '@/lib/digest/serialize'
import type { DigestBodyJson } from '@/lib/digest/schema'

describe('bodyJsonToText', () => {
  it('serializes lead + sections with items', () => {
    const input: DigestBodyJson = {
      lead: { title: 'OpenAI launches o4-mini', body: 'Available today. 80% cheaper.' },
      sections: [
        {
          name: 'AI',
          items: [
            { subject: 'Anthropic', detail: 'raises $5B at $80B valuation.' },
            { subject: 'Meta', detail: 'open-sources Llama 4 with 600B params.' },
          ],
        },
        {
          name: 'Markets',
          items: [{ subject: 'Nvidia', detail: 'clears $4T market cap.' }],
        },
      ],
    }
    const text = bodyJsonToText(input)
    expect(text).toBe(
      [
        'OpenAI launches o4-mini',
        'Available today. 80% cheaper.',
        '',
        'AI',
        '- Anthropic — raises $5B at $80B valuation.',
        '- Meta — open-sources Llama 4 with 600B params.',
        '',
        'Markets',
        '- Nvidia — clears $4T market cap.',
      ].join('\n'),
    )
  })

  it('omits the lead block when lead is null', () => {
    const input: DigestBodyJson = {
      lead: null,
      sections: [
        { name: 'AI', items: [{ subject: 'Anthropic', detail: 'raises $5B.' }] },
      ],
    }
    const text = bodyJsonToText(input)
    expect(text.startsWith('AI')).toBe(true)
    expect(text).toContain('- Anthropic — raises $5B.')
    expect(text).not.toContain('OpenAI')
  })

  it('returns empty string when lead is null and sections is empty', () => {
    expect(bodyJsonToText({ lead: null, sections: [] })).toBe('')
  })
})
