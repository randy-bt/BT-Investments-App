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
})
