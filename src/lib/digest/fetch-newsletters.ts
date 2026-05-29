// IMAP fetcher for the daily newsletter digest. Connects to the
// dedicated Gmail (randydigest@gmail.com) via an app password and
// pulls every message from the 4 known newsletter senders that
// arrived in a given date window. Strips HTML to plain text so the
// AI synthesizer gets readable input.

import { ImapFlow } from 'imapflow'

// Sender match patterns — IMAP SEARCH uses substring match on the
// "From" header. Verified against a 30-day backlog of real emails:
// - TLDR + TLDR AI both ship from dan@tldrnewsletter.com (the AI
//   variant differs only in subject line). One match covers both.
// - Rundown AI is news@daily.therundown.ai
// - Superhuman is superhuman@mail.joinsuperhuman.ai
// - Robinhood Snacks is hello@snacks.robinhood.com (subdomain caught
//   by the broader robinhood.com match).
// The fetcher dedupes by UID so any single email is only included
// once even if it matches multiple patterns.
export const NEWSLETTER_SOURCES = [
  { name: 'TLDR', match: 'tldrnewsletter.com' },
  { name: 'Rundown AI', match: 'therundown.ai' },
  { name: 'Superhuman', match: 'joinsuperhuman.ai' },
  { name: 'Robinhood Snacks', match: 'robinhood.com' },
  // Newer additions — Chartr + The Wrap verified against the actual
  // subscription list; Entry Point's exact sender is still TBD.
  { name: 'Entry Point', match: 'entrypointai' },
  { name: 'Chartr', match: 'chartr.co' },
  { name: 'The Wrap', match: 'sherwoodmedia.com' },
] as const

export type FetchedEmail = {
  source: string
  subject: string
  from: string
  receivedAt: Date
  text: string
}

// Convert HTML body to readable plain text. Strips scripts/styles,
// converts <br>/<p> to newlines, drops the rest of the tags, decodes
// the most common HTML entities, and collapses repeated whitespace.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|h[1-6]|tr|td)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Fetch every newsletter email in [since, before). Both bounds are
// half-open: since is inclusive, before is exclusive. For "today's
// digest" pass since=startOfYesterday, before=startOfToday.
export async function fetchNewsletterEmails(opts: {
  since: Date
  before: Date
}): Promise<FetchedEmail[]> {
  const user = process.env.DIGEST_GMAIL_USER
  const pass = process.env.DIGEST_GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new Error('Missing DIGEST_GMAIL_USER or DIGEST_GMAIL_APP_PASSWORD env var')
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  })

  const results: FetchedEmail[] = []
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      // IMAP doesn't OR sender filters in a single search efficiently,
      // so we run one search per source. UIDs are de-duped via a Set.
      const seenUids = new Set<number>()
      for (const source of NEWSLETTER_SOURCES) {
        const uids = await client.search({
          from: source.match,
          since: opts.since,
          before: opts.before,
        }, { uid: true })

        if (!uids || uids.length === 0) continue

        for await (const msg of client.fetch(
          uids.filter((u) => !seenUids.has(u as number)),
          { envelope: true, source: true, bodyStructure: true },
          { uid: true },
        )) {
          seenUids.add(msg.uid as number)
          const subject = msg.envelope?.subject ?? '(no subject)'
          const fromAddr = msg.envelope?.from?.[0]
          const fromStr = fromAddr ? `${fromAddr.name ?? ''} <${fromAddr.address}>`.trim() : 'Unknown'
          const receivedAt = (msg.envelope?.date as Date | undefined) ?? new Date()

          // imapflow gives the raw RFC822 source in msg.source as a
          // Buffer. We try to pull the HTML body, fall back to plain.
          const raw = msg.source ? msg.source.toString('utf8') : ''
          const text = extractBody(raw)

          results.push({
            source: source.name,
            subject,
            from: fromStr,
            receivedAt,
            text,
          })
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  // Sort chronologically so the digest reads in time order.
  results.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
  return results
}

// Very lean RFC822 body extractor: grabs the text/html part if
// present, falls back to text/plain. Strips MIME boundaries and
// decodes quoted-printable. We don't pull a full MIME parser because
// the four newsletters all use predictable structures; if any future
// source breaks this, swap in `mailparser` then.
function extractBody(raw: string): string {
  if (!raw) return ''

  // Split headers from body
  const headerEnd = raw.indexOf('\r\n\r\n')
  const bodyStart = headerEnd === -1 ? raw.indexOf('\n\n') : headerEnd
  if (bodyStart === -1) return ''
  const body = raw.slice(bodyStart + 4)
  const headers = raw.slice(0, bodyStart)

  // Find the content-type boundary if multipart
  const boundaryMatch = headers.match(/boundary=["']?([^"';\r\n]+)["']?/i)
  const boundary = boundaryMatch?.[1]

  let htmlPart = ''
  let textPart = ''

  if (boundary) {
    const parts = body.split(`--${boundary}`)
    for (const part of parts) {
      if (/Content-Type:\s*text\/html/i.test(part)) {
        htmlPart = part
      } else if (/Content-Type:\s*text\/plain/i.test(part)) {
        textPart = part
      }
    }
  } else {
    // Single-part email; assume the entire body is the content
    if (/text\/html/i.test(headers)) htmlPart = body
    else textPart = body
  }

  const chosen = htmlPart || textPart
  if (!chosen) return ''

  // Strip the MIME sub-headers from this part
  const partHeaderEnd = chosen.indexOf('\r\n\r\n') !== -1
    ? chosen.indexOf('\r\n\r\n') + 4
    : chosen.indexOf('\n\n') + 2
  const partBody = chosen.slice(partHeaderEnd)

  // Decode quoted-printable if used
  const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(chosen)
  const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(chosen)

  let decoded = partBody
  if (isBase64) {
    try {
      decoded = Buffer.from(partBody.replace(/[\r\n]/g, ''), 'base64').toString('utf8')
    } catch {
      // Leave as-is if base64 decode fails
    }
  } else if (isQP) {
    decoded = partBody
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  }

  if (htmlPart) return htmlToText(decoded)
  return decoded.replace(/\n{3,}/g, '\n\n').trim()
}
