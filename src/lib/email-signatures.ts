// Email signatures for the in-app compose dialog (Randy 7/26). The HTML
// is a faithful copy of Randy's "BT Investments - Randy" Apple Mail
// signature (same table, fonts, colors, spacing); Aldo's is identical
// with his name and the Quo line. Self-contained: web-safe fonts, no
// images, inline styles only — renders the same in Gmail/Apple Mail/
// Outlook and in the compose preview.

import { OWNER_EMAIL } from '@/lib/team'

export type EmailSignature = { html: string; text: string }

// "Explore all our companies →" (Randy 8/15, styled after the hello page:
// italic serif, pale cream on a dark ground). The signature table itself
// is light, so the treatment lives on a small dark chip - the closest an
// inline-styled, image-free email block gets to the reference. Appended
// below the signature content; Aldo only, so every dispo email carries it
// without touching composed bodies.
const EXPLORE_HTML =
  '<div style="margin-top: 14px;">' +
  '<a href="https://btinvestments.co/hello" style="display: inline-block; background-color: rgb(26, 26, 23); color: rgb(240, 238, 229); font-family: Georgia, &quot;Times New Roman&quot;, serif; font-style: italic; font-size: 14px; line-height: 1; padding: 8px 14px; border-radius: 3px; text-decoration: none;">Explore all our companies &#8594;</a>' +
  '</div>'
const EXPLORE_TEXT = 'Explore all our companies: https://btinvestments.co/hello'

function sigTable(name: string, phone: string): string {
  return (
    '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="color: rgb(26, 26, 23); font-family: -apple-system, Arial, sans-serif; border-collapse: collapse;"><tbody><tr>' +
    '<td style="padding: 0px 22px 0px 0px; vertical-align: middle;">' +
    '<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: 27px; line-height: 1; letter-spacing: -0.02em;">BT</div>' +
    '<div style="font-family: Arial, sans-serif; font-weight: 700; font-size: 8px; line-height: 1; text-transform: uppercase; letter-spacing: 3px; color: rgb(118, 121, 76); padding-top: 6px;">INVESTMENTS</div>' +
    '</td>' +
    '<td style="border-left: 1px solid rgb(88, 87, 50); padding: 3px 0px 3px 22px; vertical-align: middle;">' +
    `<div style="font-family: Georgia, &quot;Times New Roman&quot;, serif; font-size: 18px; line-height: 1.25;">${name}</div>` +
    `<div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: rgb(61, 58, 53);">${phone}</div>` +
    '<a href="https://btinvestments.co/" style="font-family: Arial, sans-serif; font-size: 11px; line-height: 1.6; letter-spacing: 1px; text-transform: uppercase; color: rgb(118, 121, 76); text-decoration: none;">BTINVESTMENTS.CO</a>' +
    '</td>' +
    '</tr></tbody></table>'
  )
}

const SIGNATURES: Record<string, { name: string; phone: string; explore?: boolean }> = {
  // Randy's phone matches his Apple Mail signature exactly.
  [OWNER_EMAIL]: { name: 'Randy Changpukdee', phone: '(425) 971-2331' },
  // Aldo carries the Quo account number (Randy 7/26) and the explore line
  // (Randy 8/15) since all dispo email sends as him.
  'aldo@btinvestments.co': { name: 'Aldo Gallegos', phone: '(425) 247-3713', explore: true },
}

/** The signature for a from-address, or null when that sender has none
 *  (e.g. the AI Agent account). */
export function signatureFor(fromEmail: string): EmailSignature | null {
  const s = SIGNATURES[fromEmail.trim().toLowerCase()]
  if (!s) return null
  return {
    html: sigTable(s.name, s.phone) + (s.explore ? EXPLORE_HTML : ''),
    text:
      `${s.name}\n${s.phone}\nBTINVESTMENTS.CO` +
      (s.explore ? `\n${EXPLORE_TEXT}` : ''),
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
