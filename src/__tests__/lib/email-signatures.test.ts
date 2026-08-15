import { describe, it, expect } from 'vitest'
import { signatureFor } from '@/lib/email-signatures'

describe('explore-all-our-companies line (Randy 8/15)', () => {
  it("rides on Aldo's signature: clickable, arrow included, hello link", () => {
    const sig = signatureFor('aldo@btinvestments.co')!
    expect(sig.html).toContain('href="https://btinvestments.co/hello"')
    expect(sig.html).toContain('Explore all our companies &#8594;')
    // The hello-page treatment, as close as inline email HTML gets:
    // italic serif in pale cream on a dark chip.
    expect(sig.html).toContain('font-style: italic')
    expect(sig.html).toContain('background-color: rgb(26, 26, 23)')
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
