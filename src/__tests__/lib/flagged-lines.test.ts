import { describe, it, expect } from 'vitest'
import { hasFlagEmoji, SEGMENT_BREAK } from '@/lib/flagged-lines'

describe('hasFlagEmoji', () => {
  it('flags the markers Randy named', () => {
    expect(hasFlagEmoji('🔷🟢 Ayush Chaturvedi - Follow Note✅')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 Kurt Ossman - Follow Note❌')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 James Hudson - Follow Up⚠️')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 Vlad Pyntya - Follow Note📆')).toBe(true)
  })

  // Broader than ACQ2's round set, by Randy's 8/10 decision.
  it('flags state markers too, unlike an ACQ2 round', () => {
    expect(hasFlagEmoji('🔷🟢 Steven Tindall - Formal Offer emailed 8.7📧')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 Martin Morgan - Move to AACQ after sending Send Mail 📬')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 Julio Parra - Follow Note💬')).toBe(true)
    expect(hasFlagEmoji('🔷🟢 Someone - Follow Note☑️')).toBe(true)
  })

  // The whole reason the rule is positional rather than end-of-line.
  it('flags a marker with a note after it', () => {
    expect(hasFlagEmoji('🔷🟢 Scott Jones - Follow Note✅ --Requesting Mail')).toBe(true)
  })

  it('flags a marker wrapped in formatting once tags are stripped', () => {
    expect(hasFlagEmoji('🔷🟢 Nicole Hamilton - Follow Note (PRIORITY)✅')).toBe(true)
  })

  it('does NOT flag the leading status run', () => {
    expect(hasFlagEmoji('🔷🟢 Kent Correa - Follow Note')).toBe(false)
    expect(hasFlagEmoji('🔷⏳ Sheryl Yang (Agent) - Follow Up August 15th')).toBe(false)
    // 📈 rides in the leading run on the marketing lines.
    expect(hasFlagEmoji('🔷🟢📈 George Brunner (Travis Fox) - Marketing @ $880k')).toBe(false)
  })

  it('does NOT flag (PRIORITY) or plain text', () => {
    expect(hasFlagEmoji('🔷🟢 Marvin Engstrom - Follow Note (PRIORITY)')).toBe(false)
    expect(hasFlagEmoji('AACQ FOLLOW UPS')).toBe(false)
    expect(hasFlagEmoji('🔷🟢 Eliaysha (Agent) - Follow Note Counter email sent 8.6')).toBe(false)
  })

  // Live AACQ regression: two leads share one <p> joined by <br>, so the
  // second line's leading 🔷🟢 lands mid-string and used to read as a flag on
  // a line where neither lead is marked.
  describe('a <br> starts a new status run', () => {
    const joined = (a: string, b: string) => `${a}${SEGMENT_BREAK}${b}`

    it('does not flag two unmarked leads sharing a block', () => {
      expect(
        hasFlagEmoji(joined('🔷🟢 Glen Stlouis - Follow Note', '🔷🟢 Karen Gonzalez - Follow Note')),
      ).toBe(false)
    })

    it('still flags when a segment really is marked', () => {
      expect(
        hasFlagEmoji(joined('🔷🟢 Glen Stlouis - Follow Note', '🔷🟢 Karen Gonzalez - Follow Note✅')),
      ).toBe(true)
      expect(
        hasFlagEmoji(joined('🔷🟢 Glen Stlouis - Follow Note❌', '🔷🟢 Karen Gonzalez - Follow Note')),
      ).toBe(true)
    })
  })

  it('handles empty and whitespace-only lines', () => {
    expect(hasFlagEmoji('')).toBe(false)
    expect(hasFlagEmoji('   ')).toBe(false)
    // A line of nothing but status emojis has no right-hand side.
    expect(hasFlagEmoji('🔷🟢')).toBe(false)
  })
})
