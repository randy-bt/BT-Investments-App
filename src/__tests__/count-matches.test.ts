import { describe, it, expect } from 'vitest'
import { countEntityMatches, getEntityMatchIds } from '@/lib/count-matches'
import type { EntityLookup } from '@/actions/entity-lookup'

const lead = (id: string, name: string): EntityLookup => ({ id, name, type: 'lead' })

// The collapsed dashboard scans the raw HTML string while the mounted editor
// reads decoded DOM text. These tests pin the two to the same answer, because
// when they disagreed the acquisitions page showed a discrepancy that
// expanding the dashboard silently "fixed".

// Exact production values, copied from the leads row and the follow_ups
// dashboard note on 2026-07-30. The emoji prefix is part of the stored name.
const PROD_NAME = '🔷 Greg & Christina Wygant'
const PROD_LINE = '<p>🔷⏳ Greg &amp; Christina Wygant - Follow Up <strong><u>Sept 16th</u></strong></p>'

const wygant = lead('lead-1', 'Greg & Christina Wygant')
const plain = lead('lead-2', 'Stephanie Lee')

describe('countEntityMatches', () => {
  it('matches the real Wygant lead against the real follow-ups line', () => {
    const prod = lead('05441162-8f28-4342-bdd4-aec883f146b3', PROD_NAME)
    expect(getEntityMatchIds(PROD_LINE, [prod])).toEqual([prod.id])
  })

  it('matches a name containing & when the note stores it as &amp;', () => {
    expect(countEntityMatches(PROD_LINE, [wygant])).toBe(1)
    expect(getEntityMatchIds(PROD_LINE, [wygant])).toEqual(['lead-1'])
  })

  it('gives the same answer whether the note is encoded or already decoded', () => {
    const encoded = '<p>Greg &amp; Christina Wygant - Follow Up</p>'
    const decoded = '<p>Greg & Christina Wygant - Follow Up</p>'
    expect(getEntityMatchIds(encoded, [wygant])).toEqual(getEntityMatchIds(decoded, [wygant]))
  })

  it('treats a non-breaking space as a space, entity or literal', () => {
    const entity = '<p>Greg &amp;&nbsp;Christina Wygant</p>'
    const literal = '<p>Greg &amp; Christina Wygant</p>'
    expect(countEntityMatches(entity, [wygant])).toBe(1)
    expect(countEntityMatches(literal, [wygant])).toBe(1)
  })

  it('decodes the other entities the editor emits', () => {
    const quoted = lead('q', '"Big Al" Smith')
    const apos = lead('a', "O'Brien Duplex")
    expect(countEntityMatches('<p>&quot;Big Al&quot; Smith - call back</p>', [quoted])).toBe(1)
    expect(countEntityMatches('<p>O&#39;Brien Duplex - under contract</p>', [apos])).toBe(1)
    expect(countEntityMatches('<p>O&#x27;Brien Duplex - under contract</p>', [apos])).toBe(1)
  })

  it('does not over-decode: &amp;lt; stays the literal text &lt;', () => {
    const odd = lead('o', '&lt; 200k')
    expect(countEntityMatches('<p>&amp;lt; 200k deals only</p>', [odd])).toBe(1)
    // and the same input must not match a real "<"
    expect(countEntityMatches('<p>&amp;lt; 200k deals only</p>', [lead('x', '< 200k')])).toBe(0)
  })

  it('counts one match per line and keeps repeats', () => {
    const html = '<p>Greg &amp; Christina Wygant</p><p>Stephanie Lee</p><p>Greg &amp; Christina Wygant</p>'
    expect(countEntityMatches(html, [wygant, plain])).toBe(3)
    expect(getEntityMatchIds(html, [wygant, plain])).toEqual(['lead-1', 'lead-2', 'lead-1'])
  })

  it('still prefers the longest name when one contains another', () => {
    const short = lead('short', 'Greg')
    const html = '<p>Greg &amp; Christina Wygant - Follow Up</p>'
    expect(getEntityMatchIds(html, [short, wygant])).toEqual(['lead-1'])
  })

  it('returns nothing for empty html or an empty lookup', () => {
    expect(countEntityMatches('', [wygant])).toBe(0)
    expect(countEntityMatches('<p>Greg &amp; Christina Wygant</p>', [])).toBe(0)
  })

  it('ignores names shorter than two characters', () => {
    expect(countEntityMatches('<p>A house on Pine</p>', [lead('s', 'A')])).toBe(0)
  })
})
