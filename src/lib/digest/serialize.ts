import type { DigestBodyJson } from './schema'

// Deterministic plain-text rendering of a structured digest body.
// Stored in daily_digests.body so old code paths and external tooling
// still see something readable; also used as the fallback render if
// body_json is somehow missing on a row that should have had it.

export function bodyJsonToText(json: DigestBodyJson): string {
  const lines: string[] = []

  if (json.lead) {
    lines.push(json.lead.title)
    lines.push(json.lead.body)
  }

  for (const section of json.sections) {
    if (section.items.length === 0) continue
    if (lines.length > 0) lines.push('')
    lines.push(section.name)
    for (const item of section.items) {
      lines.push(`- ${item.subject} — ${item.detail}`)
    }
  }

  return lines.join('\n')
}
