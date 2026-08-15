import { describe, it, expect } from 'vitest'
import { signatureFor } from '@/lib/email-signatures'

describe('explore-all-our-companies line (Randy 8/15)', () => {
  it("rides on Aldo's signature: clickable, arrow included, hello link", () => {
    const sig = signatureFor('aldo@btinvestments.co')!
    expect(sig.html).toContain('href="https://btinvestments.co/hello"')
    expect(sig.html).toContain('Explore all our companies &#8594;')
    // Plain text link, NOT a button (Randy's 2nd review): italic serif,
    // no background, no chip - and it sits INSIDE the text column (the
    // table closes after it, not before).
    expect(sig.html).toContain('font-style: italic')
    expect(sig.html).not.toContain('background-color')
    const exploreAt = sig.html.indexOf('Explore all our companies')
    expect(exploreAt).toBeGreaterThan(sig.html.indexOf('BTINVESTMENTS.CO'))
    expect(sig.html.indexOf('</table>')).toBeGreaterThan(exploreAt)
    // The four-line column gets the enlarged logo; see the balance note.
    expect(sig.html).toContain('font-size: 34px')
    // Plain-text part degrades to a readable line with the URL visible.
    expect(sig.text).toContain('Explore all our companies: https://btinvestments.co/hello')
  })

  it("does NOT ride on Randy's own signature", () => {
    const sig = signatureFor('randy@btinvestments.co')!
    expect(sig.html).not.toContain('Explore all our companies')
    expect(sig.text).not.toContain('Explore all our companies')
  })

  it('unknown senders still have no signature', () => {
    expect(signatureFor('ai-agent@btinvestments.co')).toBeNull()
  })
})

describe('signature balance (Randy 8/15: logo scales with the taller column)', () => {
  it("Randy's three-line signature keeps the original logo size", () => {
    const sig = signatureFor('randy@btinvestments.co')!
    expect(sig.html).toContain('font-size: 27px')
    expect(sig.html).not.toContain('font-size: 34px')
  })
})
