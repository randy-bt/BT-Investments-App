import { describe, it, expect } from 'vitest'
import { runDeterministicChecks } from '@/lib/agreements/review'
import type { AgreementVariable } from '@/lib/types'

const YEAR = new Date().getFullYear() + 1 // future dates so no "past" warnings

const VARS: AgreementVariable[] = [
  { key: 'emd_date', label: 'EMD / Inspection Date', type: 'text', format: 'date_long', required: true },
  { key: 'closing_date', label: 'Closing Date', type: 'text', format: 'date_long', required: true },
  { key: 'purchase_price', label: 'Purchase Price', type: 'text', format: 'number_to_words_currency', required: true },
  { key: 'emd_amount', label: 'EMD Amount', type: 'text', format: 'currency', required: true },
  { key: 'remaining_balance', label: 'Remaining Balance', type: 'computed', format: 'currency' },
  {
    key: 'payment_method', label: 'Payment Method', type: 'radio', required: true,
    radioOptions: [
      { label: 'Private Capital', placeholderKey: 'cb_private_capital' },
      { label: 'Seller Financing', placeholderKey: 'cb_seller_financing' },
    ],
  },
] as AgreementVariable[]

function goodValues(): Record<string, string> {
  return {
    emd_date: `July 8, ${YEAR}`,
    closing_date: `July 22, ${YEAR}`,
    purchase_price: '($615,000) SIX HUNDRED FIFTEEN THOUSAND DOLLARS',
    emd_amount: '$10,000',
    remaining_balance: '$605,000',
    cb_private_capital: 'X',
    cb_seller_financing: ' ',
  }
}

describe('runDeterministicChecks', () => {
  it('passes a clean contract', () => {
    expect(runDeterministicChecks(VARS, goodValues(), 'no placeholders here')).toEqual([])
  })

  it('errors on a blank required field', () => {
    const v = goodValues()
    v.emd_date = ''
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('EMD / Inspection Date'))).toBe(true)
  })

  it('errors when no radio option is checked', () => {
    const v = goodValues()
    v.cb_private_capital = ' '
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('Payment Method'))).toBe(true)
  })

  it('errors when EMD date is after the closing date', () => {
    const v = goodValues()
    v.emd_date = `August 1, ${YEAR}`
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'error' && /after.*[Cc]losing/.test(i.message))).toBe(true)
  })

  it('errors when EMD + balance does not equal the purchase price', () => {
    const v = goodValues()
    v.remaining_balance = '$600,000'
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('$600,000'))).toBe(true)
  })

  it('warns on a date that will print as raw text', () => {
    const v = goodValues()
    v.emd_date = 'TBD'
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('TBD'))).toBe(true)
  })

  it('warns on a date in the past', () => {
    const v = goodValues()
    v.emd_date = 'July 8, 2020'
    v.closing_date = 'July 22, 2020'
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'warning' && i.message.toLowerCase().includes('past'))).toBe(true)
  })

  it('errors on leftover placeholders in the final text', () => {
    const issues = runDeterministicChecks(VARS, goodValues(), 'still has {{emd_date}} inside')
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('{{emd_date}}'))).toBe(true)
  })

  it('notes the vacant/occupied contradiction when both are checked', () => {
    const v = { ...goodValues(), cb_vacant: 'X', cb_vacate_coe: 'X' }
    const issues = runDeterministicChecks(VARS, v, '')
    expect(issues.some((i) => i.severity === 'note' && i.message.toLowerCase().includes('vacant'))).toBe(true)
  })
})
