import { describe, it, expect } from 'vitest'
import { isPhotoNotice, splitHighlights } from '@/lib/listing-pages/highlights'

// The two live pages that actually have bullets, verbatim from the DB. If the
// rule ever demotes one of these real features, that is a visible regression
// on a page buyers are reading.
const GARDINER = [
  '50 feet of low-bank Lake Sammamish waterfront with a natural sandy beach, no bulkhead',
  'Newer double-decker dock (around 2010), grandfathered in and rare on this lake, plus a boat lift',
  'Two King County tax parcels convey: the 15,113 sqft waterfront lot and the adjacent 9,700 sqft back lot. Combined 2025 assessed value $4,302,000',
  'Sold mid-remodel and priced accordingly: bathrooms are disassembled and need to be put back together, hardwoods need refinishing or replacement, kitchen is intact',
  'Connected to city sewer. Heating is oil and electric: garage oil tank installed 2010, prior underground tank removed in 2000 (documentation being obtained)',
  'Roof sections replaced 2007 and 2010, full ceramic coating applied a few years ago; no flooding history per seller',
  'The rebuilt comp three doors down (2624 W Lake Sammamish Pkwy NE) sold for $4,400,000 in August 2025',
  'Professional interior photos coming this week',
]

const TUKWILA = [
  'Sold as a full renovation project. Signed seller disclosure in hand, shared on request',
  'Closing estimated early October',
  'Seller pays the City of Tukwila sewer connection fee at closing. Buyer must connect from the street and decommission the septic',
  'Two parcels convey, 8,612 sqft total. Boundary line adjustment recorded June 2026, professional survey available',
  'Title work already done: First American commitment issued, full legal description in hand',
  'Immediate access for walkthroughs',
  'Disclosed: rotten wood in the outbuildings (garage and carport)',
  'Backs to an intermodal rail yard, fronts a quiet dead-end street of newer homes',
]

describe('isPhotoNotice', () => {
  it('catches the line this was built for', () => {
    expect(isPhotoNotice('Professional interior photos coming this week')).toBe(true)
  })

  it('catches other phrasings of the same idea', () => {
    for (const t of [
      'Photos coming soon',
      'Interior photos to come',
      'Drone video being scheduled',
      'Matterport 3D tour will be added Monday',
      'Floor plans pending',
      'More pictures on the way',
    ]) {
      expect(isPhotoNotice(t), t).toBe(true)
    }
  })

  // Both signals are required, and these are the near misses that matter.
  it('does not demote a pending line that is not about media', () => {
    expect(
      isPhotoNotice('prior underground tank removed in 2000 (documentation being obtained)'),
    ).toBe(false)
    expect(isPhotoNotice('Closing estimated early October')).toBe(false)
  })

  it('does not demote a media line that is already available', () => {
    expect(isPhotoNotice('Professional photos and survey available on request')).toBe(false)
    expect(isPhotoNotice('Boundary line adjustment recorded June 2026, professional survey available')).toBe(false)
  })

  it('ignores blank input', () => {
    expect(isPhotoNotice('')).toBe(false)
    expect(isPhotoNotice('   ')).toBe(false)
  })
})

describe('splitHighlights on the live pages', () => {
  it('Gardiner: lifts exactly the photo line, keeps the other seven', () => {
    const { bullets, notices } = splitHighlights(GARDINER)
    expect(notices).toEqual(['Professional interior photos coming this week'])
    expect(bullets).toHaveLength(7)
    expect(bullets).not.toContain('Professional interior photos coming this week')
  })

  it('Tukwila: nothing is lifted', () => {
    const { bullets, notices } = splitHighlights(TUKWILA)
    expect(notices).toEqual([])
    expect(bullets).toEqual(TUKWILA)
  })

  it('loses nothing and preserves the author’s order', () => {
    for (const list of [GARDINER, TUKWILA]) {
      const { bullets, notices } = splitHighlights(list)
      expect(bullets.length + notices.length).toBe(list.length)
      expect(list.filter((b) => bullets.includes(b))).toEqual(bullets)
      expect(list.filter((b) => notices.includes(b))).toEqual(notices)
    }
  })

  it('handles a page with no bullets at all (the nine older pages)', () => {
    expect(splitHighlights(undefined)).toEqual({ bullets: [], notices: [] })
    expect(splitHighlights([])).toEqual({ bullets: [], notices: [] })
  })
})
