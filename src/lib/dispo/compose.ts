// Message composition for the dispositions send queue (agent-requests
// #14.1). Runs at TRIGGER TIME - the queue row stores finished text, so
// what Randy previews is byte-for-byte what sends, and the analyst can
// refine a queued message without touching a template layer.
//
// Two shapes, both Randy's calls:
//  - Our deals: one fixed short message per channel plus the marketing
//    page link. No persona voice.
//  - JV deals: a numbers-only blurb from the record's fields, and NEVER
//    the full address - buyers reach out for more.
//
// House copy rule applies to everything here: no em dashes.

import { dealPath } from '@/lib/deal-url'
import type { ListingPageType } from '@/lib/types'

export type ComposedMessages = {
  deal_name: string
  sms_body: string
  email_subject: string
  email_body: string
}

/**
 * The deal naming standard, used everywhere in the dispo system (14.1):
 * street number + city + (lead name) -> "4230 Tukwila (Stacie Curlee)".
 * Falls back gracefully when a piece is missing rather than emitting
 * "undefined" into a message a buyer might see.
 */
export function dealName(address: string | null, city: string | null, leadName: string | null): string {
  const streetNo = address?.trim().match(/^(\d+)/)?.[1] ?? null
  const cityPart = city?.trim() || null
  const base = [streetNo, cityPart].filter(Boolean).join(' ') || address?.trim() || 'Unnamed deal'
  return leadName?.trim() ? `${base} (${leadName.trim()})` : base
}

/** "1421 SW Olga St, Seattle, WA 98106" -> "Seattle". Null when unparseable. */
export function cityFromAddress(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  // Last part is usually "WA 98106" or "WA"; the city sits before it.
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    // Guard against "Seattle WA 98106" with no commas at all.
    if (candidate && !/^\d/.test(candidate)) return candidate.replace(/\s+WA\b.*$/i, '').trim() || null
  }
  return null
}

/** The public marketing URL for a listing. Server-safe: builds from the
 *  marketing host directly instead of dealUrl()'s window inspection. */
export function marketingUrl(slug: string, pageType: ListingPageType): string {
  return `https://btinvestments.co${dealPath(slug, pageType)}`
}

export function composeListingMessages(input: {
  address: string
  city: string | null
  price: string | null
  slug: string
  pageType: ListingPageType
  leadName: string | null
}): ComposedMessages {
  const name = dealName(input.address, input.city, input.leadName)
  const url = marketingUrl(input.slug, input.pageType)
  const priceLine = input.price?.trim() ? ` at ${input.price.trim()}` : ''
  const cityBit = input.city?.trim() || 'the area'

  return {
    deal_name: name,
    sms_body:
      `New off-market deal in ${cityBit}${priceLine}. ` +
      `Full details, photos, and numbers here: ${url} ` +
      `Reply if you want to move on it.`,
    email_subject: `New off-market deal: ${input.address}`,
    email_body:
      `We just put a new deal on the market in ${cityBit}${priceLine}.\n\n` +
      `Everything is on the property page: photos, numbers, and how to lock it down.\n\n` +
      `${url}\n\n` +
      `Reply to this email or text us if you want to move on it. These go fast.`,
  }
}

export function composeJvMessages(input: {
  address: string | null
  asking_price: string | null
  beds: number | string | null
  baths: number | string | null
  sqft: number | string | null
  /** Value estimate to quote, already resolved by the caller. */
  value_estimate: number | null
  leadName?: string | null
}): ComposedMessages {
  const city = cityFromAddress(input.address)
  const name = dealName(input.address, city, input.leadName ?? null)
  const area = city || 'the Puget Sound area'

  const facts: string[] = []
  if (input.beds != null && input.baths != null) facts.push(`${input.beds} bed / ${input.baths} bath`)
  else if (input.beds != null) facts.push(`${input.beds} bed`)
  if (input.sqft != null) facts.push(`${Number(input.sqft).toLocaleString()} sqft`)
  if (input.asking_price?.trim()) facts.push(`asking ${input.asking_price.trim()}`)
  if (input.value_estimate != null) facts.push(`value around $${Math.round(input.value_estimate).toLocaleString()}`)
  const factLine = facts.join(', ')

  return {
    deal_name: name,
    // Numbers only, no address, per 14.1. The address exists on our side;
    // interested buyers reach out and we take it from there.
    sms_body:
      `Off-market opportunity in ${area}: ${factLine}. ` +
      `Reply for the full details.`,
    email_subject: `Off-market opportunity in ${area}`,
    email_body:
      `We have an off-market opportunity in ${area}:\n\n` +
      `${factLine}\n\n` +
      `Reply to this email or text us and we will send the full details.`,
  }
}
