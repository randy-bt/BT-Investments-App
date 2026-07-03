const DIAMOND_RE = /^([🔷🔶◆])/u

// Remove emoji at the END of a dashboard line's text (status marks like
// 📞💬✅ that accumulate on the right) while leaving leading emojis
// (🔷🟢 prefixes) untouched. Works on the raw <p> HTML: repeatedly strips
// a trailing emoji run that is followed only by closing tags/whitespace,
// so emojis wrapped in trailing <span>s are caught too.
const TRAILING_EMOJI_RE =
  /[\s ]*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}‍️])+[\s ]*((?:<\/[^>]+>|[\s ])*)$/u

export function stripTrailingEmojis(blockHtml: string): string {
  let prev = ''
  let cur = blockHtml
  while (cur !== prev) {
    prev = cur
    cur = cur.replace(TRAILING_EMOJI_RE, '$1')
  }
  return cur
}

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
