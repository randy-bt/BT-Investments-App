// Listing-page ("deal") URLs are public-facing — they belong on the
// marketing host (btinvestments.co), not the app host (app.btinvestments.co).
// Both hosts serve the same Next.js codebase, so the same /deals/[slug]
// route works on either, but the URL Randy shares should always point to
// the marketing side. This helper strips the leading "app." subdomain on
// the client so the resulting absolute URL lands on the marketing host.

import type { ListingPageType } from '@/lib/types'

export function dealPath(slug: string, pageType: ListingPageType): string {
  return pageType === 'webpage' ? `/deals/${slug}` : `/deals/html/${slug}`
}

export function dealUrl(slug: string, pageType: ListingPageType): string {
  const path = dealPath(slug, pageType)
  if (typeof window === 'undefined') return path
  const host = window.location.host.startsWith('app.')
    ? window.location.host.slice(4)
    : window.location.host
  return `${window.location.protocol}//${host}${path}`
}
