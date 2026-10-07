// Deal naming rules shared by the Deals tab (dispo-deals.ts) and the Deals
// sent panel on an investor record (deal-sends.ts), so a deal reads the same
// way in both places. Kept out of the 'use server' file because that file
// may only export async functions.

import { cleanText } from '@/lib/acq2-parse'

/**
 * "🔷 George Brunner (Travis Fox)" -> { name: "🔷🟢 George Brunner",
 *                                      agent: "Agent: Travis Fox" }
 *
 * Any emoji already in the stored name is stripped first, so a lead saved as
 * "🔷 Jane" does not come out "🔷🟢 🔷 Jane".
 *
 * The agent line in the mockup has no column of its own anywhere in the
 * schema - it is written into the lead NAME as a trailing parenthetical,
 * which is how Randy records it. Treating that as the agent is an inference
 * from the live data rather than a documented rule, so it degrades quietly:
 * a parenthetical that is not an agent just shows as one, and a lead without
 * one shows no agent line at all.
 */
export function acqName(leadName: string | null): { name: string; agent: string | null } {
  const clean = cleanText(leadName ?? '').trim()
  if (!clean) return { name: '🔷🟢 Deal', agent: null }
  const m = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (m && m[1].trim()) {
    return { name: `🔷🟢 ${m[1].trim()}`, agent: `Agent: ${m[2].trim()}` }
  }
  return { name: `🔷🟢 ${clean}`, agent: null }
}

/** The sender's email domain label: '"Gayle Canares" <deals@vmhometeam.com>'
 *  -> 'vmhometeam'. Letters only, lowercased, so it can be compared against
 *  a partner record's name however that name is punctuated. */
export function senderDomainKey(source: string | null): string | null {
  if (!source) return null
  const at = source.match(/@([A-Za-z0-9.-]+)/)
  if (!at) return null
  const host = at[1].toLowerCase().replace(/\.(com|net|org|co|io|us)$/,'')
  const label = host.split('.').pop() ?? ''
  const key = label.replace(/[^a-z]/g, '')
  return key || null
}

/** Letters only, lowercased. "VM Home Team" -> "vmhometeam". */
export function nameKey(v: string | null | undefined): string {
  return (v ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

/** Partners with no record of their own yet, keyed by sender domain
 *  (Randy, Oct 2 2026: "whenever you see Gayle Canares, write VM Home
 *  Team"). A partner RECORD matched on the same key wins over this list, so
 *  creating the record retires the entry without a code change. */
export const KNOWN_PARTNERS: Record<string, string> = {
  vmhometeam: 'VM Home Team',
}


export type PartnerRecord = { name: string | null; company: string | null }

/** Letters-only keys for every partner record's company and name, first
 *  match wins. Built once per read and handed to jvPartnerCompany. */
export function partnerKeyMap(partners: PartnerRecord[]): Map<string, string> {
  const partnerByKey = new Map<string, string>()
  for (const p of partners) {
    for (const candidate of [p.company, p.name]) {
      const k = nameKey(candidate)
      if (k && candidate && !partnerByKey.has(k)) partnerByKey.set(k, candidate)
    }
  }
  return partnerByKey
}

/** The partner COMPANY for a JV deal, never a person: a partner RECORD
 *  matched on the sender's email domain, else the known-partners list, else
 *  null (show nothing rather than fall back to the human, per Randy). */
export function jvPartnerCompany(sourceName: string | null, partnerByKey: Map<string, string>): string | null {
  const key = senderDomainKey(sourceName) ?? ''
  return partnerByKey.get(key) ?? KNOWN_PARTNERS[key] ?? null
}
