import { ImapFlow } from 'imapflow'

export type JvMessage = {
  uid: number
  messageId: string | null
  from: string
  subject: string
  date: string
  body: string
}

function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function fetchNewJvMessages(opts: { sinceUid: number; sinceDate: Date }): Promise<{
  messages: JvMessage[]; maxUid: number
}> {
  const client = new ImapFlow({
    host: (process.env.JV_IMAP_HOST || 'imap.gmail.com').replace(/\\n$/, '').trim(),
    port: 993, secure: true,
    auth: {
      user: (process.env.JV_IMAP_USER || '').replace(/\\n$/, '').trim(),
      pass: (process.env.JV_IMAP_PASSWORD || '').replace(/\\n$/, '').trim(),
    },
    logger: false,
  })
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
        messages.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? msg.envelope?.messageId ?? null,
          from: parsed.from?.text ?? msg.envelope?.from?.[0]?.address ?? 'unknown',
          subject: parsed.subject ?? msg.envelope?.subject ?? '(no subject)',
          date: (internalDate ?? new Date()).toISOString(),
          body,
        })
        maxUid = Math.max(maxUid, msg.uid)
      }
    } finally { lock.release() }
  } finally { await client.logout() }
  return { messages, maxUid }
}
