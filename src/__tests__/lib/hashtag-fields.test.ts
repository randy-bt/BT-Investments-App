import { describe, it, expect } from 'vitest'
import { stripHashtags, hashtagValueSource, SUMMARY_BLOCKED_FIELDS } from '@/lib/hashtag-fields'

/** The client parser's logic, reproduced over the shared pattern, so these
 *  tests assert what would ACTUALLY be written to the lead - not merely that
 *  some text disappeared. */
function parse(text: string, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keys) {
    const m = new RegExp(hashtagValueSource(key), 'gm').exec(text)
    if (m && m[1].trim()) out[key] = m[1].trim()
  }
  return out
}

const ALL = ['asking_price', 'our_current_offer', 'range', 'condition', 'selling_timeline', 'occupancy_status']

describe('summarizer pricing guard (Randy 8/13, agent-requests #12)', () => {
  // The verbatim tag block from the 8.13 Zinovy Royzen summary. The $850k-$925k
  // was what the SELLER said her agents valued the house at; it was written
  // into BT's range field and Randy found a number he never set.
  const zinovy = [
    '#asking_price $800,000',
    '#range $850,000-$925,000 (agent estimates)',
    '#condition Pretty good; basement fully remodeled 4 years ago',
    '#selling_timeline Closing in a couple of days',
    '#occupancy_status Not confirmed',
  ].join('\n')

  it('drops range from the Zinovy block and keeps the seller-side fields', () => {
    const safe = stripHashtags(zinovy, SUMMARY_BLOCKED_FIELDS)
    const fields = parse(safe, ALL)

    expect(fields.range).toBeUndefined()
    expect(fields.our_current_offer).toBeUndefined()

    expect(fields.asking_price).toBe('$800,000')
    expect(fields.condition).toBe('Pretty good; basement fully remodeled 4 years ago')
    expect(fields.selling_timeline).toBe('Closing in a couple of days')
    expect(fields.occupancy_status).toBe('Not confirmed')
  })

  // The overwrite case, which is what made this dangerous rather than untidy:
  // Randy's approved range was silently replaced by an agent's rejected offer.
  it('drops the range that overwrote Mary Armanious', () => {
    const safe = stripHashtags(
      "#range $550,000-$600,000 for both (agent's initial offer, rejected)",
      SUMMARY_BLOCKED_FIELDS,
    )
    expect(parse(safe, ALL).range).toBeUndefined()
    expect(safe).not.toContain('#range')
  })

  it('drops our_current_offer too', () => {
    const safe = stripHashtags('#our_current_offer $725,000\n#asking_price $800,000', SUMMARY_BLOCKED_FIELDS)
    const fields = parse(safe, ALL)
    expect(fields.our_current_offer).toBeUndefined()
    expect(fields.asking_price).toBe('$800,000')
  })

  // The tags are written on their own lines today, but the parser also matches
  // them mid-line. The strip has to cover everything the parser would find, or
  // a tag survives and is applied anyway.
  it('strips a tag written mid-line, not just on its own line', () => {
    const safe = stripHashtags('Seller wants more. #range $1M-$1.2M #condition Rough', SUMMARY_BLOCKED_FIELDS)
    const fields = parse(safe, ALL)
    expect(fields.range).toBeUndefined()
    expect(fields.condition).toBe('Rough')
  })

  it('leaves the prose alone - the number is still readable, just not written', () => {
    const summary = [
      'Seller says her agents valued it at $850,000-$925,000.',
      '',
      '#range $850,000-$925,000 (agent estimates)',
    ].join('\n')
    const safe = stripHashtags(summary, SUMMARY_BLOCKED_FIELDS)
    expect(safe).toContain('her agents valued it at $850,000-$925,000')
    expect(parse(safe, ALL).range).toBeUndefined()
  })

  it('is a no-op on a summary that never mentioned the blocked fields', () => {
    const summary = '#asking_price $500,000\n#condition Needs roof'
    expect(stripHashtags(summary, SUMMARY_BLOCKED_FIELDS)).toBe(summary)
  })

  // Randy types #range himself through the feed autocomplete. That path does
  // not go through the strip, and this asserts the pattern still reads it -
  // guarding the parser instead would have quietly taken this away from him.
  it('a hand-typed #range still parses (the strip is summary-only)', () => {
    expect(parse('8.13 Ran comps. #range $600,000-$700,000', ALL).range).toBe('$600,000-$700,000')
  })
})
