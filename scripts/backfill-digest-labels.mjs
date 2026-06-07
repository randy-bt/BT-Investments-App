// One-off: applies the "Digested" Gmail label to every email that
// contributed to a past digest but never got labeled. Pre-redesign
// builds only labeled on cron-triggered runs, so any manually-built
// digest left its source emails unlabeled. This walks every digest
// row's source_emails JSONB, re-locates each message by sender + day
// via IMAP, and applies the label.
//
// Idempotent: Gmail's messageCopy to the same label is a no-op if the
// message already has it, and `\Seen` add is harmless if already set.
//
// Run once: node scripts/backfill-digest-labels.mjs

import { ImapFlow } from 'imapflow'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const DIGESTED_LABEL = 'Digested'

const env = {}
{
  const text = readFileSync(resolve(projectRoot, '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
}

const need = ['DIGEST_GMAIL_USER', 'DIGEST_GMAIL_APP_PASSWORD', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const k of need) {
  if (!env[k]) {
    console.error(`Missing env: ${k}`)
    process.exit(1)
  }
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('Loading source_emails from all digest rows...')
const { data: digests, error } = await admin
  .from('daily_digests')
  .select('id, digest_date, source_emails')
  .order('created_at', { ascending: true })

if (error) {
  console.error('Supabase error:', error.message)
  process.exit(1)
}

// Dedupe by (from, received_at) so retries within the same script run
// don't search the same window twice.
const targets = new Map()
let unparsedDates = 0
for (const d of digests ?? []) {
  for (const e of d.source_emails ?? []) {
    const key = `${e.from}|${e.received_at}`
    if (targets.has(key)) continue
    // Handle both ISO ("2026-06-05T22:56:01.964Z") and the natural-
    // language format the catchup script wrote ("April 28, 2026 at
    // 4:05 AM"). The `at` keyword breaks Date.parse, so strip it.
    let receivedAt = new Date(e.received_at)
    if (isNaN(receivedAt.getTime())) {
      const cleaned = String(e.received_at).replace(/\s+at\s+/i, ' ')
      receivedAt = new Date(cleaned)
    }
    if (isNaN(receivedAt.getTime())) {
      unparsedDates++
      continue
    }
    targets.set(key, {
      from: e.from,
      receivedAt,
      digestDate: d.digest_date,
      subject: e.subject,
    })
  }
}

console.log(`Found ${targets.size} unique source emails across ${digests.length} digests`)
if (unparsedDates > 0) {
  console.log(`Skipped ${unparsedDates} entries with unparseable received_at (likely catchup-PDF rows not present in Gmail).`)
}

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: { user: env.DIGEST_GMAIL_USER, pass: env.DIGEST_GMAIL_APP_PASSWORD },
  logger: false,
})

await client.connect()

let totalMatched = 0
let totalSearched = 0
const matchedUids = new Set()

try {
  try { await client.mailboxCreate(DIGESTED_LABEL) } catch {} // already exists is fine

  const lock = await client.getMailboxLock('INBOX')

  try {
    for (const t of targets.values()) {
      totalSearched++

      // Pull just the email address. Catchup-script rows use a
      // "Name addr" format (no angle brackets); current digest rows
      // use "Name <addr>". Match any bare email-shaped substring.
      const addr =
        t.from.match(/<([^>]+)>/)?.[1] ??
        t.from.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ??
        t.from

      // Day window around received_at. IMAP since/before is date-precision,
      // so a +/- 1 day pad guarantees we catch the message regardless of
      // timezone interpretation.
      const since = new Date(t.receivedAt.getTime() - 24 * 60 * 60 * 1000)
      const before = new Date(t.receivedAt.getTime() + 24 * 60 * 60 * 1000)

      let uids
      try {
        uids = await client.search({ from: addr, since, before }, { uid: true })
      } catch (e) {
        console.warn(`  search failed for ${addr} @ ${t.receivedAt.toISOString()}: ${e.message}`)
        continue
      }

      if (!uids || uids.length === 0) {
        console.warn(`  no match: ${addr} @ ${t.receivedAt.toISOString()} (subject: ${t.subject?.slice(0, 60)})`)
        continue
      }

      for (const uid of uids) matchedUids.add(uid)
      totalMatched += uids.length

      if (totalSearched % 10 === 0) {
        console.log(`  ${totalSearched}/${targets.size} searched, ${matchedUids.size} unique UIDs collected`)
      }
    }

    console.log(`\nSearch complete: ${totalSearched} searches, ${matchedUids.size} unique UIDs to label`)

    if (matchedUids.size > 0) {
      const uidArr = [...matchedUids]
      console.log(`Applying Digested label + \\Seen to ${uidArr.length} messages...`)
      await client.messageCopy(uidArr, DIGESTED_LABEL, { uid: true })
      await client.messageFlagsAdd(uidArr, ['\\Seen'], { uid: true })
      console.log('Done.')
    } else {
      console.log('Nothing to label.')
    }
  } finally {
    lock.release()
  }
} finally {
  await client.logout()
}

console.log(`\nSummary: scanned ${targets.size} source_email entries, found ${matchedUids.size} unique IMAP messages, all now labeled as "${DIGESTED_LABEL}".`)
