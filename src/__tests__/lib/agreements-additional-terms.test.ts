import { describe, it, expect } from 'vitest'
import { additionalTermsLine, fillOptionalTextDefaults } from '@/lib/agreements/additional-terms'
import type { AgreementVariable } from '@/lib/types'

const VARS: AgreementVariable[] = [
  { key: 'title_company', label: 'Title/Escrow Company', type: 'text', required: true },
  { key: 'additional_terms', label: 'Additional Terms', type: 'text', required: false },
  { key: 'cb_escrow', label: 'Escrow', type: 'radio', radioOptions: [] },
]

describe('additional terms line (Randy, Oct 9 2026)', () => {
  it('prints as its own labelled line when filled and as nothing when blank', () => {
    expect(additionalTermsLine("Seller's 1.5% listing fee is included in the 50/50 closing cost split.")).toBe(
      "8a. ADDITIONAL TERMS: Seller's 1.5% listing fee is included in the 50/50 closing cost split.",
    )
    expect(additionalTermsLine('')).toBe('')
    expect(additionalTermsLine('   ')).toBe('')
    expect(additionalTermsLine(undefined)).toBe('')
  })

  it('fills missing text variables with blank so the bridge can omit them, and leaves given values alone', () => {
    const values = fillOptionalTextDefaults(VARS, { title_company: 'Ticor Title' })
    expect(values).toEqual({ title_company: 'Ticor Title', additional_terms: '' })
    const filled = fillOptionalTextDefaults(VARS, { title_company: 'Ticor Title', additional_terms: 'Fee included' })
    expect(filled.additional_terms).toBe('8a. ADDITIONAL TERMS: Fee included')
    // radio placeholders are not text variables and are not invented
    expect('cb_escrow' in filled).toBe(false)
  })
})
