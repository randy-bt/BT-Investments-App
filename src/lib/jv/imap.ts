import { ImapFlow } from 'imapflow'

export type JvMessage = {
  uid: number
  messageId: string | null
  from: string
  subject: string
  date: string
  body: string
  /** Original HTML (or text wrapped in <pre>) — archived to storage so
   *  cards can open the real email without a Gmail login. */
  rawHtml: string
}

function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/** Vercel env values sometimes carry a literal trailing "\n". */
function clean(v: string | undefined): string {
  return (v || '').replace(/\\n$/, '').trim()
}

export type JvAccount = {
  /** Env suffix: '' for the original mailbox, '_2' and up for later ones.
   *  Also the suffix on this account's watermark and cutoff settings keys,
   *  which is why the first mailbox must keep the empty string - changing it
   *  would reset jv_last_uid and rescan well over a thousand messages. */
  suffix: string
  user: string
  host: string
  pass: string
}

/**
 * Every configured JV mailbox (Randy 7/31: JV senders reach more than one
 * inbox, so scanning only btinvestmentsdeals@gmail.com silently dropped the
 * deals that landed elsewhere).
 *
 * Add a mailbox by setting JV_IMAP_USER_2 and JV_IMAP_PASSWORD_2. An account
 * with either half missing is skipped rather than half-configured, so a typo
 * cannot take the whole scan down. JV_IMAP_HOST_2 is optional and falls back
 * to the shared host.
 */
export function getJvAccounts(): JvAccount[] {
  const baseHost = clean(process.env.JV_IMAP_HOST) || 'imap.gmail.com'
  const accounts: JvAccount[] = []
  for (const suffix of ['', '_2', '_3', '_4', '_5']) {
    const user = clean(process.env[`JV_IMAP_USER${suffix}`])
    const pass = clean(process.env[`JV_IMAP_PASSWORD${suffix}`])
    if (!user || !pass) continue
    accounts.push({
      suffix,
      user,
      pass,
      host: clean(process.env[`JV_IMAP_HOST${suffix}`]) || baseHost,
    })
  }
  return accounts
}

function connect(account: JvAccount): ImapFlow {
  return new ImapFlow({
    host: account.host,
    port: 993,
    secure: true,
    auth: { user: account.user, pass: account.pass },
    logger: false,
  })
}

/** Mark processed JV emails read in the inbox (Randy 7/24): once a message
 *  is in the system, its unread badge should stop asking for attention.
 *  Unlisted senders are deliberately left unread - those DO need his eyes. */
export async function markJvMessagesSeen(account: JvAccount, uids: number[]): Promise<void> {
  if (uids.length === 0) return
  const client = connect(account)
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageFlagsAdd({ uid: uids.join(',') }, ['\\Seen'], { uid: true })
    } finally { lock.release() }
  } finally { await client.logout() }
}

export async function fetchNewJvMessages(
  account: JvAccount,
  opts: { sinceUid: number; sinceDate: Date },
): Promise<{ messages: JvMessage[]; maxUid: number }> {
  const client = connect(account)
  const messages: JvMessage[] = []
  let maxUid = opts.sinceUid
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      // UID range from sinceUid+1 upward; also gate by internal date.
      const range = `${opts.sinceUid + 1}:*`
      for await (const msg of client.fetch(
        { uid: range }, { uid: true, envelope: true, internalDate: true, source: true },
      )) {
        if (msg.uid <= opts.sinceUid) continue
        const internalDate = msg.internalDate ? new Date(msg.internalDate) : null
        if (internalDate && internalDate < opts.sinceDate) { maxUid = Math.max(maxUid, msg.uid); continue }
        const { simpleParser } = await import('mailparser')
        const parsed = await simpleParser(msg.source as Buffer)
        const body = (parsed.text && parsed.text.trim())
          ? parsed.text
          : (parsed.html ? htmlToText(parsed.html) : '')
        const rawHtml = parsed.html
          ? String(parsed.html)
          : `<pre style="white-space:pre-wrap;font-family:sans-serif">${(parsed.text ?? '')
              .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
        messages.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? msg.envelope?.messageId ?? null,
          from: parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? 'unknown',
          subject: parsed.subject ?? msg.envelope?.subject ?? '(no subject)',
          date: (internalDate ?? new Date()).toISOString(),
          body,
          rawHtml,
        })
        maxUid = Math.max(maxUid, msg.uid)
      }
    } finally { lock.release() }
  } finally { await client.logout() }
  return { messages, maxUid }
}
