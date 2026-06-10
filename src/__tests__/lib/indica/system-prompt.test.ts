import { describe, it, expect } from 'vitest'
import { buildIndicaSystemPrompt } from '@/lib/indica/system-prompt'

describe('buildIndicaSystemPrompt', () => {
  it('includes the asker name in the addressing directive', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'Randy', entityType: 'lead' })
    expect(out).toContain('Randy')
  })

  it('mentions both entity types correctly', () => {
    expect(buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })).toContain('lead')
    expect(buildIndicaSystemPrompt({ askerName: 'X', entityType: 'investor' })).toContain('investor')
  })

  it('encodes the honesty directive', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })
    expect(out.toLowerCase()).toMatch(/don.?t.*have|not.*in.*the.*record/i)
  })

  it('encodes the conciseness directive', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })
    expect(out.toLowerCase()).toMatch(/concise|short/i)
  })

  it('encodes the citation directive', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })
    expect(out.toLowerCase()).toMatch(/cite|source/i)
  })

  it('encodes the scope boundary', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })
    expect(out.toLowerCase()).toContain('only')
  })

  it('encodes the data freshness rule (notes/transcripts override stale structured fields)', () => {
    const out = buildIndicaSystemPrompt({ askerName: 'X', entityType: 'lead' })
    expect(out.toLowerCase()).toMatch(/snapshot|may not have been updated/i)
    expect(out.toLowerCase()).toMatch(/note.*authoritative|transcript.*authoritative|notes.*source of truth|transcripts.*source of truth|reflect the most current state/i)
  })
})
