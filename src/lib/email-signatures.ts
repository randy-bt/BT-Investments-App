// Email signatures for the in-app compose dialog (Randy 7/26). The HTML
// is a faithful copy of Randy's "BT Investments - Randy" Apple Mail
// signature (same table, fonts, colors, spacing); Aldo's is identical
// with his name and the Quo line. Self-contained: web-safe fonts, no
// images, inline styles only — renders the same in Gmail/Apple Mail/
// Outlook and in the compose preview.

import { OWNER_EMAIL } from '@/lib/team'

export type EmailSignature = { html: string; text: string }

// "Explore all our companies →" (Randy 8/15, revised 2nd review): a plain
// TEXT link, not a button - his words after seeing the chip render as one.
// It sits INSIDE the signature's text column, directly below the
// btinvestments.co line, as just another line of that column. Italic
// Georgia keeps his serif reference; the olive matches the site link
// above it so it reads as part of the set.
const EXPLORE_HTML =
  '<div style="padding-top: 1px;">' +
  '<a href="https://btinvestments.co/hello" style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-style: italic; font-size: 12px; line-height: 1.4; color: rgb(118, 121, 76); text-decoration: none;">Explore all our companies &#8594;</a>' +
  '</div>'
const EXPLORE_TEXT = 'Explore all our companies: https://btinvestments.co/hello'

function sigTable(name: string, phone: string | null, explore: boolean): string {
  // The mark scales with the COLUMN HEIGHT, not with the explore flag.
  // That distinction became load-bearing on 8/24: Randy dropped his
  // phone line and gained the explore line, so he now has explore AND a
  // three-line column - the old `explore ? 34 : 27` would have given him
  // a four-line mark against a three-line column. Height is the real
  // driver; the flag only ever correlated with it.
  //
  // Font-size-only scaling, still: no images, nothing email clients
  // handle inconsistently.
  const lines = 1 + (phone ? 1 : 0) + 1 + (explore ? 1 : 0)
  const btSize = lines >= 4 ? 34 : 27
  const subSize = lines >= 4 ? 9 : 8
  return (
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="color: rgb(26, 26, 23); font-family: -apple-system, Arial, sans-serif; border-collapse: collapse;"><tbody><tr>' +
    '<td style="padding: 0px 22px 0px 0px; vertical-align: middle;">' +
    `<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: ${btSize}px; line-height: 1; letter-spacing: -0.02em;">BT</div>` +
    `<div style="font-family: Arial, sans-serif; font-weight: 700; font-size: ${subSize}px; line-height: 1; text-transform: uppercase; letter-spacing: 3px; color: rgb(118, 121, 76); padding-top: 6px;">INVESTMENTS</div>` +
    '</td>' +
    '<td style="border-left: 1px solid rgb(88, 87, 50); padding: 3px 0px 3px 22px; vertical-align: middle;">' +
    `<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: 18px; line-height: 1.25;">${name}</div>` +
    (phone ? `<div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: rgb(61, 58, 53);">${phone}</div>` : '') +
    '<a href="https://btinvestments.co/" style="font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; letter-spacing: 1px; text-transform: uppercase; color: rgb(118, 121, 76); text-decoration: none;">BTINVESTMENTS.CO</a>' +
    (explore ? EXPLORE_HTML : '') +
    '</td>' +
    '</tr></tbody></table>'
  )
}

const SIGNATURES: Record<string, { name: string; phone?: string; explore?: boolean }> = {
  // Randy dropped his phone line on 8/24, leaving a three-line column:
  // name / site / explore.
  [OWNER_EMAIL]: { name: 'Randy Changpukdee', explore: true },
  // Aldo carries the Quo account number (Randy 7/26) and the explore line
  // (Randy 8/15) since all dispo email sends as him - four lines.
  'aldo@btinvestments.co': { name: 'Aldo Gallegos', phone: '(425) 247-3713', explore: true },
}

/** The signature for a from-address, or null when that sender has none
 *  (e.g. the AI Agent account). */
export function signatureFor(fromEmail: string): EmailSignature | null {
  const s = SIGNATURES[fromEmail.trim().toLowerCase()]
  if (!s) return null
  return {
    html: sigTable(s.name, s.phone ?? null, s.explore ?? false),
    text: [s.name, s.phone, 'BTINVESTMENTS.CO', s.explore ? EXPLORE_TEXT : null]
      .filter((line): line is string => Boolean(line))
      .join('\n'),
  }
}

/** Escape body text and convert newlines so the typed message renders in
 *  the HTML email exactly as typed. */
export function bodyTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/\n/g, '<br>')
}
