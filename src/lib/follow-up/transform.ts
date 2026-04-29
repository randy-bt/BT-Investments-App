const DIAMOND_RE = /^([🔷🔶◆])/u

export function transformLineToFollowUp(
  blockHtml: string,
  leadName: string,
  isoDate: string,
  friendly: string
): string {
  const wrapperMatch = blockHtml.match(/^(<p[^>]*>)([\s\S]*)(<\/p>)$/)
  if (!wrapperMatch) {
    return `<p>${buildBody(leadName, isoDate, friendly, '')}</p>`
  }
  const [, openTag, inner, closeTag] = wrapperMatch
  const plain = inner.replace(/<[^>]+>/g, '').trim()
  const diamondMatch = plain.match(DIAMOND_RE)
  const diamond = diamondMatch ? diamondMatch[1] : ''
  return `${openTag}${buildBody(leadName, isoDate, friendly, diamond)}${closeTag}`
}

function buildBody(
  leadName: string,
  isoDate: string,
  friendly: string,
  diamond: string
): string {
  const dateSpan = `<strong><u data-fu-date="${isoDate}">${escapeHtml(friendly)}</u></strong>`
  const prefix = diamond ? `${diamond}⏳ ` : '⏳ '
  return `${prefix}${escapeHtml(leadName)} - Follow Up ${dateSpan}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
