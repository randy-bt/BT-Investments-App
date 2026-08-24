import { describe, it, expect } from 'vitest'
import { signatureFor } from '@/lib/email-signatures'

// Randy's approved render, 8/24 (Geoffrey's signatures artifact). Pinned
// byte-for-byte: this HTML is what he looked at and signed off, and it
// goes out on every email the Send Email action produces, so drift is a
// red test rather than something noticed in a buyer's inbox.
const RANDY_APPROVED =
  '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="color: rgb(26, 26, 23); font-family: -apple-system, Arial, sans-serif; border-collapse: collapse;"><tbody><tr>' +
  '<td style="padding: 0px 22px 0px 0px; vertical-align: middle;">' +
  '<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: 27px; line-height: 1; letter-spacing: -0.02em;">BT</div>' +
  '<div style="font-family: Arial, sans-serif; font-weight: 700; font-size: 8px; line-height: 1; text-transform: uppercase; letter-spacing: 3px; color: rgb(118, 121, 76); padding-top: 6px;">INVESTMENTS</div>' +
  '</td>' +
  '<td style="border-left: 1px solid rgb(88, 87, 50); padding: 3px 0px 3px 22px; vertical-align: middle;">' +
  '<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: 18px; line-height: 1.25;">Randy Changpukdee</div>' +
  '<a href="https://btinvestments.co/" style="font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; letter-spacing: 1px; text-transform: uppercase; color: rgb(118, 121, 76); text-decoration: none;">BTINVESTMENTS.CO</a>' +
  '<div style="padding-top: 1px;"><a href="https://btinvestments.co/hello" style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-style: italic; font-size: 12px; line-height: 1.4; color: rgb(118, 121, 76); text-decoration: none;">Explore all our companies &#8594;</a></div>' +
  '</td>' +
  '</tr></tbody></table>'

describe("Randy's signature (8/24: phone out, explore in)", () => {
  const sig = signatureFor('randy@btinvestments.co')!

  it('matches the approved render byte for byte', () => {
    expect(sig.html).toBe(RANDY_APPROVED)
  })

  it('the phone line is gone from both parts', () => {
    expect(sig.html).not.toContain('971-2331')
    expect(sig.text).not.toContain('971-2331')
  })

  it('carries the explore line', () => {
    expect(sig.html).toContain('Explore all our companies &#8594;')
    expect(sig.text).toContain('Explore all our companies: https://btinvestments.co/hello')
  })

  it('plain text is the three lines, in order', () => {
    expect(sig.text).toBe(
      'Randy Changpukdee\nBTINVESTMENTS.CO\nExplore all our companies: https://btinvestments.co/hello',
    )
  })
})

describe('mark scale follows COLUMN HEIGHT, not the explore flag', () => {
  // The 8/24 change is what made this distinction matter: Randy has the
  // explore line AND only three lines. Keying the mark off `explore`
  // (as the code did) would have given him a four-line mark.
  it("Randy's three-line column keeps the original 27px mark", () => {
    const html = signatureFor('randy@btinvestments.co')!.html
    expect(html).toContain('font-size: 27px')
    expect(html).toContain('font-size: 8px')
    expect(html).not.toContain('font-size: 34px')
  })

  it("Aldo's four-line column keeps the enlarged 34px mark", () => {
    const html = signatureFor('aldo@btinvestments.co')!.html
    expect(html).toContain('font-size: 34px')
    expect(html).toContain('font-size: 9px')
    expect(html).not.toContain('font-size: 27px')
  })
})

describe("Aldo's signature (content unchanged, spacing tightened)", () => {
  const sig = signatureFor('aldo@btinvestments.co')!

  it('keeps the Quo number and the explore line', () => {
    expect(sig.html).toContain('(425) 247-3713')
    expect(sig.html).toContain('Explore all our companies &#8594;')
    expect(sig.text).toBe(
      'Aldo Gallegos\n(425) 247-3713\nBTINVESTMENTS.CO\nExplore all our companies: https://btinvestments.co/hello',
    )
  })
})

describe('the 8/24 tightening applies to both', () => {
  for (const who of ['randy@btinvestments.co', 'aldo@btinvestments.co']) {
    it(`${who.split('@')[0]}: explore padding 1px and site line-height 1.5`, () => {
      const html = signatureFor(who)!.html
      expect(html).toContain('<div style="padding-top: 1px;">')
      expect(html).not.toContain('padding-top: 4px')
      // The site anchor specifically; the phone div keeps 1.6.
      expect(html).toContain('font-size: 11px; line-height: 1.5;')
      expect(html).toContain('font-size: 12px; line-height: 1.4;')
    })
  }
})

it('senders without a signature still have none', () => {
  expect(signatureFor('ai-agent@btinvestments.co')).toBeNull()
})
