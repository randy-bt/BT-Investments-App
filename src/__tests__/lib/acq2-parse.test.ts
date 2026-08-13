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

  it('does not qualify the ballot-box check (☑️ marks parked, not a decision)', () => {
    const lines = parseQualifyingLines('<p>🔷🟢 Martin Morgan - Follow Note☑️ --Requesting Mail</p>')
    expect(lines).toHaveLength(0)
    // but the line still parses cleanly for board membership
    const all = parseBoardLines('<p>🔷🟢 Martin Morgan - Follow Note☑️ --Requesting Mail</p>')
    expect(all).toHaveLength(1)
    expect(all[0].lineText).toContain('Martin Morgan')
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

describe('state markers stay out of a round (Randy 8/1, supersedes 7/31 §1)', () => {
  // exact live board lines: state-marked, so they must parse cleanly for
  // board membership but never pull the lead into a round
  it('📆 qualifies (Randy added it back directly, 8/1)', () => {
    const lines = parseQualifyingLines('<p>🔷🟢 Donald Ausink - Follow Note📆</p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('📆')
    expect(lines[0].lineText).toContain('Donald Ausink')
    expect(lines[0].lineText).not.toContain('🔷')
  })
  it('📬 does not qualify (Martin Morgan pattern) but the line parses', () => {
    const html = '<p>🔷🟢 Martin Morgan - Move to AACQ after sending (<strong>Send Mail </strong>📬)</p>'
    expect(parseQualifyingLines(html)).toHaveLength(0)
    expect(parseBoardLines(html)).toHaveLength(1)
  })
  it('📧 does not qualify', () => {
    expect(attentionMarkersIn('Send intro 📧')).toBe('')
  })
  it('a decision flag beside a state marker qualifies on both', () => {
    const lines = parseQualifyingLines('<p>🔷🟢 Some Lead - Follow Note📬✅</p>')
    expect(lines).toHaveLength(1)
    expect(lines[0].markers).toBe('✅')
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

// ---- 🟨 owner marker (Randy 8/12, agent-requests #10) ----

import { OWNER_MARKER, todoFromLine, ATTENTION_MARKERS } from '@/lib/acq2-parse'

describe('🟨 owner marker', () => {
  // Verbatim from the live AACQ board.
  const LIVE = [
    '🔷🟢 Stacie Curlee (Agent) - EMD $20k due TODAY 9pm, inspection expires same time. 17 investors matched, none contacted yet🟨',
    '🔷🟢 Anne Gardiner - Send PSA v3 ($2.9m, $50k EMD) plus proof of funds. Waiting on Leka for the POF letter🟨',
    '🔷🟢 Steven Tindall - Send the $2m offer for both houses. Still sitting unsent in your drafts🟨',
    '🔷🟢 William Steffes - Mail the $340k offer to Wichita. Letter is written and ready in Deliveries🟨',
    '🔷🟢 James Hudson - Send the mail packet. Never went out, and the follow up was due Aug 10🟨',
    '🔷🟢 Martin Morgan - Send the mail packet. Never went out🟨',
  ]

  it('is in the round flag set, so a 🟨 lead reaches ACQ2 at all', () => {
    expect(ATTENTION_MARKERS).toContain(OWNER_MARKER)
  })

  it('pulls every live 🟨 line into a round', () => {
    const html = LIVE.map((l) => `<p>${l}</p>`).join('')
    const qualifying = parseQualifyingLines(html)
    expect(qualifying).toHaveLength(6)
    expect(qualifying.every((l) => l.markers.includes(OWNER_MARKER))).toBe(true)
  })

  it('does not count a 🟨 sitting in the leading status run', () => {
    expect(parseQualifyingLines('<p>🔷🟨 Someone - Follow Note</p>')).toHaveLength(0)
  })

  it('leaves the older markers working', () => {
    const html = '<p>🔷🟢 A - Follow Note✅</p><p>🔷🟢 B - Follow Note❌</p><p>🔷🟢 C - Follow Up📆</p>'
    expect(parseQualifyingLines(html)).toHaveLength(3)
  })
})

describe('todoFromLine', () => {
  it('strips the lead name so the row shows only the to-do', () => {
    expect(
      todoFromLine('Stacie Curlee (Agent) - EMD $20k due TODAY 9pm, inspection expires same time', 'Stacie Curlee (Agent)'),
    ).toBe('EMD $20k due TODAY 9pm, inspection expires same time')
  })

  it('handles a name stored with its 🔷 prefix', () => {
    expect(todoFromLine('William Steffes - Mail the $340k offer to Wichita', '🔷 William Steffes'))
      .toBe('Mail the $340k offer to Wichita')
  })

  it('accepts the other dashes and a colon', () => {
    expect(todoFromLine('A – do it', 'A')).toBe('do it')
    expect(todoFromLine('A — do it', 'A')).toBe('do it')
    expect(todoFromLine('A: do it', 'A')).toBe('do it')
  })

  // Showing too much beats showing nothing.
  it('falls back to the whole line when there is no separator', () => {
    expect(todoFromLine('Send the mail packet', 'Someone Else')).toBe('Send the mail packet')
  })

  it('falls back rather than returning empty when the line is just the name', () => {
    expect(todoFromLine('Anne Gardiner', 'Anne Gardiner')).toBe('Anne Gardiner')
  })
})
