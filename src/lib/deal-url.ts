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

/**
 * The active-deals index.
 *
 * The slug is deliberately unguessable: the old path (/deals-index-active) had
 * been shared with people who should no longer have the list, and renaming the
 * route is what revoked them (v7.34.0). The page also sends noindex and is
 * kept out of robots.txt and the sitemap, because robots.txt is public and
 * listing it there would publish the very thing being kept quiet.
 *
 * IF THIS EVER ROTATES AGAIN, two things must change together: this constant
 * and the directory name under src/app/. The folder name IS the route, so
 * there is nothing to derive it from.
 */
export const DEAL_INDEX_PATH = '/active-deals-wdy9a3vf3ff9'

/** Absolute URL on the marketing host, same host rule as dealUrl above. */
export function dealIndexUrl(): string {
  if (typeof window === 'undefined') return DEAL_INDEX_PATH
  const host = window.location.host.startsWith('app.')
    ? window.location.host.slice(4)
    : window.location.host
  return `${window.location.protocol}//${host}${DEAL_INDEX_PATH}`
}
