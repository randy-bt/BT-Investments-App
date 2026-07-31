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
    expect(attentionMarkersIn('☑️')).toBe('☑️')
    expect(attentionMarkersIn('☑')).toBe('☑️')
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

  it('qualifies the ballot-box check (☑️) same as ✅', () => {
    const lines = parseQualifyingLines('<p>🔷🟢 Martin Morgan - Follow Note☑️ --Requesting Mail</p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('☑️')
    expect(lines[0].lineText).toContain('Martin Morgan')
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

// ---- fix list 7/31, from the first live round ----

import { parseBoardLines } from '@/lib/acq2-parse'

describe('full flag vocabulary (fix list §1)', () => {
  // exact lines from the live boards that failed to qualify
  it('recognizes 📆 (Donald Ausink pattern)', () => {
    const lines = parseQualifyingLines('<p>🔷🟢 Donald Ausink - Follow Note📆</p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('📆')
  })
  it('recognizes 📬 inside markup (Martin Morgan pattern)', () => {
    const lines = parseQualifyingLines(
      '<p>🔷🟢 Martin Morgan - Move to AACQ after sending (<strong>Send Mail </strong>📬)</p>',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('📬')
  })
  it('recognizes 📧', () => {
    expect(attentionMarkersIn('Send intro 📧')).toBe('📧')
  })
  it('still ignores left-side status emojis as flags', () => {
    expect(parseQualifyingLines('<p>🔷🟢<strong>📈</strong> George Brunner - Marketing @ $880k</p>')).toHaveLength(0)
  })
})

describe('(PRIORITY) is never a flag (fix list §2)', () => {
  // the exact lines the fix list quoted for Stacie Curlee - neither carries
  // a flag emoji, so neither may qualify, whatever tags or dashes they hold
  it('does not qualify a bare (PRIORITY) line', () => {
    expect(
      parseQualifyingLines('<p>🔷🟢 Stacie Curlee (Agent) - Follow Note <strong>(PRIORITY)</strong></p>'),
    ).toHaveLength(0)
  })
  it('does not qualify the dual-board marketing line', () => {
    expect(
      parseQualifyingLines(
        '<p>🔷🟢<strong>📈</strong> Stacie.Curlee (Agent) – <strong>Marketing @ $415k - BLA Complete Ready to Proceed</strong></p>',
      ),
    ).toHaveLength(0)
  })
  it('qualifies (PRIORITY)✅ on the checkmark alone', () => {
    const lines = parseQualifyingLines(
      '<p>🔷🟢 Stacie Curlee (Agent) - Follow Note <strong>(PRIORITY)✅</strong></p>',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('✅')
  })
})

describe('parseBoardLines (badge decoupled from flags, fix list §1)', () => {
  it('returns unflagged lines too, with empty markers', () => {
    const lines = parseBoardLines(
      '<p>🔷🟢 Chengyan Peng - Follow Note</p><p>🔷🟢 Kenneth Wiley - Follow Note✅</p>',
    )
    expect(lines).toHaveLength(2)
    expect(lines[0].markers).toBe('')
    expect(lines[1].markers).toBe('✅')
  })
  it('degrades gracefully on an unknown flag emoji: line still parses clean', () => {
    const lines = parseBoardLines('<p>🔷🟢 Some Lead - Follow Note🧲</p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('')          // unknown emoji is not a flag
    expect(lines[0].lineText).not.toContain('🔷') // left-side run stripped anyway
  })
})
