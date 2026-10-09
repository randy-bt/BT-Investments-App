// Aldo's follow-up texts (Randy 10/9): three canned SMS templates behind
// the "Send FU Text 1/2/3" quick actions on a lead record. Pure: the
// dialog previews the filled text and sends it through Quo.

import { cleanText } from '@/lib/acq2-parse'

export type FuTextNumber = 1 | 2 | 3

export const FU_TEXT_TEMPLATES: Record<FuTextNumber, string> = {
  1: "Hi {first_name}, it's Aldo with BT Investments. I just tried calling about {address}. We buy houses as-is in the area and I'd love to see if we can put a fair cash offer together for you. Is there a good time to talk today or tomorrow?",
  2: 'Hi {first_name}, Aldo again from BT Investments. Still interested in {address} if selling is on your mind. No repairs, no showings, no agent fees, and you pick the closing date. Even a quick "not right now" helps me know where you stand. Thanks!',
  3: "Hi {first_name}, this is my last note for now about {address}. I'll keep your file open in case timing changes, and if you ever want a no-pressure number on the house, just reply here and I'll get it to you. Appreciate your time. Aldo, BT Investments",
}

export const FU_TEXT_LABELS: Record<FuTextNumber, string> = {
  1: 'Send FU Text 1',
  2: 'Send FU Text 2',
  3: 'Send FU Text 3',
}

/** First name from a lead's display name: emoji and status prefixes
 *  stripped, first word. '' when there is nothing usable. */
export function firstNameOf(name: string | null | undefined): string {
  const clean = cleanText(name ?? '')
  const first = clean.split(/\s+/)[0] ?? ''
  // "Smith, Dan" style names put the first name second.
  if (first.endsWith(',')) return clean.split(/\s+/)[1] ?? ''
  return first.replace(/[,.]+$/, '')
}

/** Street part of an address: everything before the first comma. */
export function streetOf(address: string | null | undefined): string {
  return (address ?? '').split(',')[0].trim()
}

/** The filled template. Fallbacks: "Hi," when there is no first name and
 *  "your property" when there is no address. */
export function fillFuText(n: FuTextNumber, lead: { name?: string | null; address?: string | null }): string {
  const first = firstNameOf(lead.name)
  const street = streetOf(lead.address)
  return FU_TEXT_TEMPLATES[n]
    .replace('Hi {first_name},', first ? `Hi ${first},` : 'Hi,')
    .replace('{address}', street || 'your property')
}
