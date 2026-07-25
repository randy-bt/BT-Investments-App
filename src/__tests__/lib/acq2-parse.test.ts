import { describe, it, expect } from 'vitest'
import {
  trailingEmojiRun,
  attentionMarkersIn,
  parseQualifyingLines,
  resolveLead,
} from '@/lib/acq2-parse'

describe('trailingEmojiRun', () => {
  it('captures the right-edge emoji run and nothing else', () => {
    expect(trailingEmojiRun('🔷🟢 David Poe ✅')).toBe('✅')
    expect(trailingEmojiRun('🔷 Jane Doe 📞 ✅')).toBe('📞✅')
    expect(trailingEmojiRun('Plain name, no emojis')).toBe('')
  })
  it('handles variation selectors (⚠️)', () => {
    expect(trailingEmojiRun('🔷 Bob Smith ⚠️').includes('⚠')).toBe(true)
  })
})

describe('attentionMarkersIn', () => {
  it('finds each qualifying marker', () => {
    expect(attentionMarkersIn('✅')).toBe('✅')
    expect(attentionMarkersIn('❌')).toBe('❌')
    expect(attentionMarkersIn('⚠️')).toBe('⚠️')
    expect(attentionMarkersIn('⚠')).toBe('⚠️')
  })
  it('qualifies when markers ride alongside other status emojis', () => {
    expect(attentionMarkersIn('📞✅')).toBe('✅')
  })
  it('is empty for non-qualifying runs', () => {
    expect(attentionMarkersIn('📞💬')).toBe('')
    expect(attentionMarkersIn('')).toBe('')
  })
})

describe('parseQualifyingLines', () => {
  const board = [
    '<p>🔷🟢 David Poe ✅</p>',
    '<p>🔷 Jane Doe 📞</p>', // no qualifying marker → ignored
    '<p>🔶 <strong>Carlos Rivera</strong> ⚠️</p>',
    '<p>🔷 Amy Chen ❌</p>',
    '<p></p>', // empty
    '<p>Just a divider note</p>', // no trailing emojis
  ].join('')

  it('keeps only lines with right-side attention markers, in order', () => {
    const lines = parseQualifyingLines(board)
    expect(lines.map((l) => l.lineText)).toEqual(['David Poe', 'Carlos Rivera', 'Amy Chen'])
    expect(lines.map((l) => l.markers)).toEqual(['✅', '⚠️', '❌'])
  })

  it('strips markup inside lines (styled names still parse)', () => {
    const lines = parseQualifyingLines('<p><span style="color:red">🔷 Zed Q</span> <em>✅</em></p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].lineText).toBe('Zed Q')
  })

  it('qualifies mid-line markers (ACQ board convention)', () => {
    const lines = parseQualifyingLines(
      '<p>🔷🟢 Stacie Curlee (Agent) - Follow Note✅ --Review email she sent</p>' +
        '<p>🔷🟢 Thomas Dalpay - Onboarding✅ ---Needs a large/Mid scale developer</p>',
    )
    expect(lines.map((l) => l.markers)).toEqual(['✅', '✅'])
    expect(lines[0].lineText).toContain('Stacie Curlee')
  })

  it('ignores markers in the leading status-emoji run (left of the name)', () => {
    expect(parseQualifyingLines('<p>✅ DONE - section header</p>')).toHaveLength(0)
  })
})

describe('resolveLead', () => {
  const leads = [
    { id: 'a', name: 'Dan' },
    { id: 'b', name: 'Dan Smith Jr' },
    { id: 'c', name: '🔷 Amy Chen' },
  ]
  it('prefers the longest matching name', () => {
    expect(resolveLead('dan smith jr called back', leads)?.id).toBe('b')
  })
  it('matches emoji-stripped lead names', () => {
    expect(resolveLead('amy chen', leads)?.id).toBe('c')
  })
  it('returns null when nothing matches', () => {
    expect(resolveLead('totally unknown person', leads)).toBeNull()
  })
})
