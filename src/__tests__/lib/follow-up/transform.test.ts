import { describe, it, expect } from 'vitest'
import { transformLineToFollowUp } from '@/lib/follow-up/transform'

const ISO = '2026-05-06'
const FRIENDLY = 'May 6th'

describe('transformLineToFollowUp', () => {
  it('replaces a status emoji + suffix per the example', () => {
    const before = '<p>🔷🟢 Huiling Chen - Follow Note</p>'
    const after = transformLineToFollowUp(before, 'Huiling Chen', ISO, FRIENDLY)
    expect(after).toContain('🔷⏳')
    expect(after).toContain('Huiling Chen')
    expect(after).toContain('Follow Up')
    expect(after).toContain('<strong><u data-fu-date="2026-05-06">May 6th</u></strong>')
    expect(after).not.toContain('🟢')
    expect(after).not.toContain('Follow Note')
  })

  it('inserts ⏳ after diamond when no status emoji present', () => {
    const before = '<p>🔷 John Doe — note</p>'
    const after = transformLineToFollowUp(before, 'John Doe', ISO, FRIENDLY)
    expect(after).toContain('🔷⏳')
    expect(after).toContain('John Doe')
  })

  it('handles lines with no diamond and no status emoji', () => {
    const before = '<p>Jane Smith thinking</p>'
    const after = transformLineToFollowUp(before, 'Jane Smith', ISO, FRIENDLY)
    expect(after).toContain('⏳')
    expect(after).toContain('Jane Smith')
    expect(after).toContain('Follow Up')
  })
})

import { stripTrailingEmojis } from '@/lib/follow-up/transform'

describe('stripTrailingEmojis', () => {
  it('removes emojis at the end of a dashboard line', () => {
    expect(stripTrailingEmojis('<p>🔷🟢 Susan Marglin - Onboarding 📞💬</p>')).toBe(
      '<p>🔷🟢 Susan Marglin - Onboarding</p>'
    )
  })
  it('keeps leading emojis untouched', () => {
    expect(stripTrailingEmojis('<p>🔷🟢 Susan Marglin - Onboarding</p>')).toBe(
      '<p>🔷🟢 Susan Marglin - Onboarding</p>'
    )
  })
  it('handles emojis wrapped in trailing tags', () => {
    expect(stripTrailingEmojis('<p>🔷 Dan Crisan - Active <span>✅</span></p>')).toBe(
      '<p>🔷 Dan Crisan - Active <span></span></p>'.replace('<span></span>', '<span></span>')
    )
  })
  it('leaves lines without trailing emojis alone', () => {
    expect(stripTrailingEmojis('<p>plain text line</p>')).toBe('<p>plain text line</p>')
  })
})
