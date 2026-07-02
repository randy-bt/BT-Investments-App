import { parseCityState } from './compute'

// Strip filesystem-invalid characters and collapse whitespace.
function sanitize(part: string): string {
  return part.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// Agreement PDF naming convention:
//   "REVIEW FIRST - BT Investments - <house#> <city> - <lead name> - <TYPE> V<n>.pdf"
// e.g. "REVIEW FIRST - BT Investments - 12020 Bellevue - Dan Crisan - PSA V1.pdf"
//
// - "REVIEW FIRST" is a deliberate safeguard: Randy reviews + renames the
//   file before sending, since the contract was machine-drafted.
// - The lead name comes from the LEAD RECORD (what Randy knows sellers by),
//   with the leading status emoji (🔷 etc.) stripped.
// - V<n> counts drafts per (lead, agreement type): a re-draft becomes V2.
// - Falls back gracefully when the address or lead is missing.
export function buildAgreementFilename(opts: {
  agreementType: string
  address: string
  leadName: string
  version: number
}): string {
  const type = sanitize(opts.agreementType) || 'Agreement'
  const name = sanitize((opts.leadName ?? '').replace(/^[^\p{L}]+/u, ''))

  const street = (opts.address || '').split(',')[0]?.trim() ?? ''
  const house = street.match(/^(\d+)/)?.[1] ?? ''
  const cityState = parseCityState(opts.address || '')
  const city = cityState ? cityState.split(',')[0].trim() : ''
  const subject = sanitize([house, city].filter(Boolean).join(' '))

  const mid =
    subject && name && subject !== name
      ? `${subject} - ${name}`
      : subject || name || 'Agreement'

  return `REVIEW FIRST - BT Investments - ${mid} - ${type} V${opts.version}.pdf`
}
