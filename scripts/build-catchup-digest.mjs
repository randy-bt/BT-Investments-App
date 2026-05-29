// One-off: build a "catch-up" digest from the 102 backlog PDFs in
// /Users/groovehouseent/Desktop/OOLDMAIL. Treats them as one giant
// bundle, asks Claude to produce a multi-week catch-up digest, and
// upserts the result into daily_digests dated 2026-05-29 (latest
// date covered in the backlog).
//
// Run once: node scripts/build-catchup-digest.mjs

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Load env from both .env.local and .env.production.tmp (which the
// caller pulls via `vercel env pull .env.production.tmp --environment=production`
// since ANTHROPIC_API_KEY only lives in Production env).
const env = {}
for (const candidate of ['.env.local', '.env.production.tmp']) {
  const path = resolve(projectRoot, candidate)
  let text
  try { text = readFileSync(path, 'utf8') } catch { continue }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    // Some keys in the Vercel-pulled env have a literal "\n" suffix
    // from how they were originally set — strip it so auth headers are clean.
    v = v.replace(/\\n$/, '')
    env[m[1]] = v
  }
}

const PDF_DIR = '/Users/groovehouseent/Desktop/OOLDMAIL'
const DIGEST_DATE = '2026-05-29'
const PER_ARTICLE_CHAR_CAP = 2000
const MODEL = 'claude-sonnet-4-6'

const CATCHUP_SYSTEM_PROMPT = `You are producing a single multi-week CATCH-UP digest covering ~30 days of newsletter content the reader fell behind on. The reader subscribes to TLDR, TLDR AI, The Rundown AI, Superhuman (AI), and Robinhood Snacks. He hasn't read any of these since April 27, 2026, and wants to get caught up in one read.

Output format:

1) Start with a single bold line beginning with "**" and ending with "**". This is the headline — one sentence calling out the biggest narratives across the entire ~30-day window. Make it specific (name the biggest companies, products, or events by name).

2) Blank line, then a body organized as the catch-up itself. Use this structure:

**THE BIG PICTURE** — a short paragraph (4-6 sentences) describing the overall arc of the last month: what mattered most, what shifted, what's now obvious.

**AI & MODELS** — group everything model/lab related (OpenAI, Anthropic, Google, xAI, Meta AI, etc.). Cover product launches, valuations, partnerships, controversies. 6-15 paragraphs.

**AI PRODUCTS & DEVELOPER TOOLS** — Cursor, Codex, Claude Code, Gemini, MCP, agents, IDEs, coding assistants, Replit. 4-10 paragraphs.

**HARDWARE & INFRA** — chips (NVIDIA, AMD, TPUs, Huawei), data centers, robotics, devices (AirPod cameras, AI phones, Apple/Meta hardware). 3-8 paragraphs.

**MARKETS & BUSINESS** — earnings, IPOs, acquisitions, big tech moves, Robinhood Snacks-style market coverage (Big Tech earnings, NVIDIA, GameStop, Tesla, Google, anything financial). 4-8 paragraphs.

**EVERYTHING ELSE** — anything noteworthy that doesn't fit above (science breakthroughs, court cases, regulation, geopolitical, oddities). 3-6 paragraphs.

3) Within each section, write in flowing prose paragraphs — NOT bullet points. Reference specific company names, dollar amounts, dates ("on May 14"), people, and quotes when present in the source material. Group multiple related stories into single paragraphs when they share a theme. Don't repeat the same story across sections.

4) DO NOT include any preamble like "Here's your catch-up digest" or "Today's news:". DO NOT include a closing summary or "what to watch" section.

5) Be substantive — Randy wants the real catch-up, not a 3-bullet teaser. The body should run long; this is replacing weeks of reading.`

async function main() {
  // Prefer NEWS_ANTHROPIC_API_KEY since the news module is known to
  // work — ANTHROPIC_API_KEY may have been rotated.
  const apiKey = env.NEWS_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')
  if (!env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE URL missing')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')

  // Enumerate PDFs (filenames have a leading space we need to honor)
  const files = readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf'))
  console.log(`Found ${files.length} PDFs in ${PDF_DIR}`)

  const articles = []
  let failed = 0
  for (const file of files) {
    const full = join(PDF_DIR, file)
    let text
    try {
      text = execFileSync('pdftotext', ['-layout', full, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    } catch (e) {
      failed += 1
      console.error(`  ✗ ${file}: ${e.message}`)
      continue
    }
    const lines = text.split('\n').map((l) => l.trim())
    const fromLine = lines.find((l) => l.startsWith('From:'))
    const subjLine = lines.find((l) => l.startsWith('Subject:'))
    const dateLine = lines.find((l) => l.startsWith('Date:'))

    const from = fromLine ? fromLine.replace(/^From:\s*/, '') : 'Unknown'
    const subject = subjLine ? subjLine.replace(/^Subject:\s*/, '') : '(no subject)'
    const date = dateLine ? dateLine.replace(/^Date:\s*/, '') : ''

    // Body = everything after the header block. Find the line after Date:
    const dateIdx = lines.findIndex((l) => l.startsWith('Date:'))
    const toIdx = lines.findIndex((l, i) => i > dateIdx && l.startsWith('To:'))
    const bodyStart = toIdx >= 0 ? toIdx + 1 : dateIdx + 1
    let body = lines.slice(bodyStart).filter(Boolean).join('\n')
    // Strip common newsletter chrome
    body = body
      .replace(/Read Online \| Sign Up \| Advertise/g, '')
      .replace(/Unsubscribe[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    const truncated = body.length > PER_ARTICLE_CHAR_CAP
      ? body.slice(0, PER_ARTICLE_CHAR_CAP) + ' [...truncated]'
      : body

    // Decide the source label from the From line
    let source = 'Unknown'
    if (from.includes('therundown.ai')) source = 'The Rundown AI'
    else if (from.includes('joinsuperhuman.ai')) source = 'Superhuman'
    else if (from.includes('robinhood.com')) source = 'Robinhood Snacks'
    else if (from.includes('tldrnewsletter.com')) source = subject.toLowerCase().includes('tldr ai') ? 'TLDR AI' : 'TLDR'
    else if (from.includes('chartr.co')) source = 'Chartr'
    else if (from.includes('sherwoodmedia.com')) source = 'The Wrap'
    else if (from.includes('starterstory.com')) source = 'Starter Story'
    else if (from.includes('hubspot.com')) source = 'HubSpot'

    articles.push({ source, subject, from, date, text: truncated })
  }

  console.log(`Parsed ${articles.length} articles (${failed} failed).`)
  // Sort by date — best effort
  articles.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Bundle for Claude
  const bundled = articles
    .map(
      (a, i) =>
        `## ARTICLE ${i + 1} — ${a.source}\nSubject: ${a.subject}\nDate: ${a.date}\n\n${a.text}`,
    )
    .join('\n\n---\n\n')

  console.log(`Bundled content: ~${bundled.length.toLocaleString()} chars`)

  console.log('Calling Claude for the catch-up synthesis…')
  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: CATCHUP_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Here are ${articles.length} newsletter emails spanning roughly April 27 – May 29, 2026. Synthesize them into one CATCH-UP digest using the format described in the system prompt.\n\n${bundled}`,
    }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text.trim())
    .join('\n')
    .trim()

  if (!text) throw new Error('Empty digest returned')

  // Split headline from body
  let headline = ''
  let body = text
  const m = text.match(/^\*\*([\s\S]+?)\*\*\s*\n+/)
  if (m) {
    headline = m[1].trim()
    body = text.slice(m[0].length).trim()
  } else {
    const nl = text.indexOf('\n')
    headline = (nl === -1 ? text : text.slice(0, nl)).replace(/^\*+|\*+$/g, '').trim()
    body = nl === -1 ? '' : text.slice(nl + 1).trim()
  }

  console.log(`Headline: ${headline}`)
  console.log(`Body length: ~${body.length.toLocaleString()} chars`)
  console.log(`Tokens used: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`)

  const sourceEmails = articles.map((a) => ({
    source: a.source,
    subject: a.subject,
    from: a.from,
    received_at: a.date,
    excerpt: a.text.length > 1500 ? a.text.slice(0, 1500) + '…' : a.text,
  }))

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  console.log(`Upserting digest for ${DIGEST_DATE}…`)
  const { error } = await supabase
    .from('daily_digests')
    .upsert({
      digest_date: DIGEST_DATE,
      headline,
      body,
      source_emails: sourceEmails,
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      email_count: articles.length,
    }, { onConflict: 'digest_date' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`\n✓ Catch-up digest saved as ${DIGEST_DATE} — open /app/digest to read.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
