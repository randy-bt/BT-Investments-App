import { describe, it, expect } from 'vitest'
import { buildAgreementFilename } from '@/lib/agreements/filename'

describe('buildAgreementFilename', () => {
  it('builds the full REVIEW FIRST convention', () => {
    expect(
      buildAgreementFilename({
        agreementType: 'PSA',
        address: '12020 SE 42nd Ct, Bellevue, WA',
        leadName: '🔷 Dan Crisan',
        version: 1,
      })
    ).toBe('REVIEW FIRST - BT Investments - 12020 Bellevue - Dan Crisan - PSA V1.pdf')
  })

  it('numbers re-drafts (V2, V3...)', () => {
    expect(
      buildAgreementFilename({
        agreementType: 'PSA',
        address: '9635 12th Ave SW Seattle, WA',
        leadName: '🔷 Eliaysha (Agent)',
        version: 3,
      })
    ).toBe('REVIEW FIRST - BT Investments - 9635 Seattle - Eliaysha (Agent) - PSA V3.pdf')
  })

  it('finds the city even when the address has no state', () => {
    expect(
      buildAgreementFilename({
        agreementType: 'PSA',
        address: '7024 SE 20th St Mercer Island',
        leadName: 'Sukhminder Dhaliwal',
        version: 1,
      })
    ).toBe('REVIEW FIRST - BT Investments - 7024 Mercer Island - Sukhminder Dhaliwal - PSA V1.pdf')
  })

  it('falls back gracefully when there is no address', () => {
    expect(
      buildAgreementFilename({
        agreementType: 'PSA',
        address: '',
        leadName: '🔷 Jane Doe',
        version: 2,
      })
    ).toBe('REVIEW FIRST - BT Investments - Jane Doe - PSA V2.pdf')
  })

  it('falls back when there is no lead at all', () => {
    expect(
      buildAgreementFilename({ agreementType: 'PSA', address: '', leadName: '', version: 1 })
    ).toBe('REVIEW FIRST - BT Investments - Agreement - PSA V1.pdf')
  })

  it('strips characters that are invalid in filenames', () => {
    expect(
      buildAgreementFilename({
        agreementType: 'PSA',
        address: '1 A St, Seattle, WA',
        leadName: '🔷 Bob "The Builder" / Sons',
        version: 1,
      })
    ).toBe('REVIEW FIRST - BT Investments - 1 Seattle - Bob The Builder Sons - PSA V1.pdf')
  })
})
