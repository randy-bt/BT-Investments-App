// Bulk create investor records from a JSON array (passed in-file).
// Mirrors the createInvestor server action's flow:
//   1. investors row (created_by = Randy)
//   2. investor_locations rows (split on , or ;)
//   3. investor_phones rows (first phone marked is_primary)
//   4. investor_emails rows (first email marked is_primary)
// Usage: edit INVESTORS below, then `node scripts/bulk-create-investors.mjs`
// Prepends "💰 " to every name unless already prefixed.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const env = {}
for (const line of readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ADMIN_EMAIL = 'randy@btinvestments.co'

// Replace this array per batch. See the existing entries below as the
// shape — `notes` becomes deals_notes, `locations` becomes
// locations_of_interest.
const INVESTORS_PREVIOUS_18 = [
  {
    name: 'Alex Kissling',
    locations: 'Pierce Co., Bonney Lake, Sumner, Buckley',
    phones: ['(253) 243-0444'],
    emails: [],
    notes: 'Mostly deals in Pierce County — Bonney Lake, Sumner, Buckley (confirmed 1.19). Briefly engaged 1.6 (asked for the Kent link), then unreachable for days. 1.19 said not interested in Kent. Active deal: 9831 West Seattle sent 3.6 — daily no-answer follow-ups since 3.7 through 3.24. Past: 2103 Kent (1.6) and 5039 Seattle (1.17) — both fell off.',
  },
  {
    name: 'Augustus',
    locations: 'Edmonds',
    phones: [],
    emails: [],
    notes: 'Edmonds focus. No phone on file. No deals sent yet.',
  },
  {
    name: 'Bethanie Fritz',
    locations: 'North King, Snohomish',
    phones: ['(206) 883-8212'],
    emails: [],
    notes: 'North King + Snohomish. Active deals: 9831 West Seattle, 15222 Bellevue, 6629 Lynnwood, 16231 Martha Lake all sent 3.6. 3.9 said hasn\'t had a chance to review. 3.12 said she will reach out if interested.',
  },
  {
    name: 'Christian & Shannon Nossum',
    locations: 'King, Snohomish Co.',
    phones: [],
    emails: [],
    notes: 'King + Snohomish. No phone or email on file. No deals sent yet.',
  },
  {
    name: 'Eva — TEXT ONLY',
    locations: 'King, Snohomish',
    phones: ['(206) 226-6151'],
    emails: ['eva@croasdalehomes.com'],
    notes: 'TEXT ONLY — do not call. 1.23 stated explicitly: "if I haven\'t responded then I\'m not interested." Has investors she works with on a regular basis. Active deals: 9831 West Seattle, 15222 Bellevue, 6629 Lynnwood, 16231 Martha Lake all sent 3.6 — no responses through 3.13. Past: 2103 Kent + 11006/525/10028 Seattle (1.8), 5039 Seattle (1.17) — all no response.',
  },
  {
    name: 'Feras Rabi',
    locations: 'South King Co., Pierce Co. (NOT Seattle)',
    phones: ['(253) 987-6199'],
    emails: [],
    notes: 'NOT interested in Seattle (confirmed 1.7) — wants South King + Pierce. 1.12 said for 2103 Kent to work he\'d need it at $380–400K. 3.11 told us he\'s not interested in 9831 West Seattle. Past: 2103 Kent (12.29).',
  },
  {
    name: 'Jerome',
    locations: 'King, Pierce, Snohomish',
    phones: ['(425) 954-5729'],
    emails: ['jerome@d2rei.com'],
    notes: 'King/Pierce/Snohomish, still actively investing around Seattle (1.14). Came in via call with Aldo 1.7 — sent 4 deals via email same day. 1.14 reviewed and not interested. 3.12 reviewed the latest batch (West Seattle, Bellevue, Lynnwood, Martha Lake from 3.6) and decided not to proceed. Past: 2103 Kent + 11006/525/10028 Seattle (1.7), 5039 Seattle (1.17–1.22).',
  },
  {
    name: 'Julia Carolina',
    locations: 'King, Pierce, Snohomish Co.',
    phones: ['(650) 450-3935'],
    emails: [],
    notes: 'Has a business partner. 1.10 offered $500K on 2103 Kent (very low). 3.9 review of latest batch: 9831 West Seattle could work at ~$280K, 15222 Bellevue could work at $1.27M–$1.3M, NOT interested in 6629 Lynnwood. Past: 2103 Kent (12.29), 11006/525/10028 Seattle (1.6), 5039 Seattle (1.17 — ARV ~$975K, Reno would lead to negative profit per her).',
  },
  {
    name: 'Kamaljit Tumber',
    locations: 'Renton (Highland, Sunset, downtown Renton) — North only, nothing south',
    phones: ['(206) 715-2471'],
    emails: [],
    notes: 'Agent with John L Scott — mainly does flips. Renton and north only, nothing south. Looking for small houses to renovate/rent, $350–400K, under $500K. Originally a prospect (16418 108th Ave SE, Renton — but doesn\'t own it). Not interested in 9831 West Seattle (3.7). 3.10 said 15222 Bellevue is out of his price range. Past: 5039 Seattle (1.17).',
  },
  {
    name: 'Kyle Rixon',
    locations: 'King, Pierce Co.',
    phones: ['(425) 344-1498'],
    emails: ['Rixonkyle.nwre@gmail.com'],
    notes: 'DO NOT CALL — TEXT/EMAIL ONLY. Said this explicitly multiple times: 1.22, 1.29 ("if interested he will reach out"), 3.23 ("🛑"). 1.15 asked us to send links to his email. Active deal: 9831 West Seattle sent 3.6 — daily no-answer call attempts since 3.9 through 3.21 (ignore — we shouldn\'t be calling). Past: 2103 Kent + 11006/525/10028 Seattle + 5039 Seattle all via email/text, never converted.',
  },
  {
    name: 'Kyle Rossman',
    locations: 'Seattle, Pierce Co.',
    phones: ['(253) 691-8165'],
    emails: [],
    notes: 'TEXT ONLY — sent text 1.13 saying "Thank you for sending me your deals, but please stop calling me. If my clients are interested I will let you know." Both an agent AND investor. Looking for 2+ bedrooms, NO manufactured homes. 1.2 sounded interested in Seattle deals. Active deal: 9831 West Seattle sent 3.6, 3.12 said he hasn\'t had opportunity to review, will reach out if interested. Past: 2103 Kent (12.27), 11006/525/10028 Seattle (1.6), 5039 Seattle (1.17) — all never responded.',
  },
  {
    name: 'Lien Nguyen',
    locations: 'Seattle (W Seattle, Beacon Hill)',
    phones: ['(206) 999-5273'],
    emails: ['mylien160294@gmail.com'],
    notes: 'EMAIL ONLY — said 1.17 "email me deals, no need to call." 1.8 said not interested in the original 4, would consider West Seattle and Beacon Hill. Active deal: 9831 West Seattle sent 3.6 via text — no answer on daily follow-up calls 3.7 through 3.24 (should be email follow-ups instead). Past: 2103 Kent + 11006/525/10028 Seattle (1.7), 5039 Seattle (1.17).',
  },
  {
    name: 'Nile Arkush',
    locations: 'Snohomish County, North part of King County (nothing south of Northgate), Shelton',
    phones: ['(425) 341-3230'],
    emails: ['Nile@lvpsllc.com'],
    notes: 'Looking for: Single Families, Townhomes, Condos with garage. NOT interested in links — said 2.12 to just describe deals to her. Snohomish + north King (nothing south of Northgate), also Shelton. 3.11 said nothing piqued her interest, asked us to keep her in mind. Active deals: 9831 West Seattle, 15222 Bellevue, 6629 Lynnwood, 16231 Martha Lake sent 3.6. Past: 2103 Kent (1.12), 525/5039 Seattle (1.21 via email).',
  },
  {
    name: 'Raymundo Olivas',
    locations: 'Federal Way to Everett',
    phones: ['(206) 255-3753'],
    emails: [],
    notes: 'Address: 1253 S Henderson St, Seattle, WA. Has multiple rental properties — has considered tearing down and rebuilding bigger. Interested in deals Federal Way to Everett if numbers are right (2.11). 3.7 said hasn\'t had opportunity to review, currently investing in Seattle area. 3.9 said NOT working any deals till after tax season. Active deals: 9831 West Seattle, 15222 Bellevue, 6629 Lynnwood, 16231 Martha Lake sent 3.6.',
  },
  {
    name: 'Rizwan',
    locations: 'King, Pierce, Snohomish Co.',
    phones: ['(206) 334-8540'],
    emails: [],
    notes: 'CLOSED 2103 Kent — original wholesale buyer (✅ 12.27). Closing was delayed because seller bought a new house and we needed lender\'s paid-in-full doc — extended close to 2/20 (per 2.9 text update). Sent updated dossier 2.9 with 11006 Seattle + 5039 Seattle as next options. 3.7 reviewed the 3.6 batch — nothing piqued his interest. 3.12 said if interested he\'ll reach out. Past: 11006/5039 Seattle (2.9), 9831/15222/6629/16231 (3.6).',
  },
  {
    name: 'Rubie Nguyen',
    locations: 'King Co., Pierce Co. (South Seattle to Lakewood)',
    phones: ['(315) 916-9524'],
    emails: [],
    notes: 'South Seattle to Lakewood. 1.8 requested all 4 of the original deals via text. 1.30 NOT interested in 5039 Seattle. 3.7 asked if we have duplexes or fourplexes (we have 2 duplexes in Lynnwood — should follow up). Active deal: 9831 West Seattle sent 3.6, plus duplex follow-up pending. Past: 2103 Kent + 11006/525/10028 Seattle (1.8), 5039 Seattle (1.26).',
  },
  {
    name: 'Sindhu',
    locations: 'North & West Seattle, Pierce, King, Snohomish Co. (bigger lots — 8000+ sqft)',
    phones: ['(206) 602-9269'],
    emails: [],
    notes: 'Specifically looking for BIGGER LOTS (8000+ sqft) — Seattle-only DADU deals don\'t cut it (told us 3.11). Active in north and west Seattle. 1.9 not interested in any of the original 4. 1.19 not interested in south Seattle. 3.11 not interested in Lynnwood, said the Seattle DADU opportunity wasn\'t big enough. 3.12 we acknowledged and told her we\'ll keep her in mind. Past: 2103 Kent + 11006/525/10028 Seattle, 5039 Seattle, 9831/15222/6629/16231 (3.6).',
  },
  {
    name: 'Zach Flowers',
    locations: 'Pierce Co.',
    phones: ['(253) 961-6933'],
    emails: [],
    notes: 'Pierce County. 1.3 said NOT interested in Kent or Seattle. Minimal interaction since.',
  },
]

const INVESTORS_PREVIOUS_NEVER_REACHED = [
  {
    name: 'Andy',
    locations: 'King Co.',
    phones: ['(361) 648-2727'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. ~30+ no-answer call attempts from 1.2 through 2.3, including the standard "are you still interested" / "we\'ll take you off the list" follow-ups. 361 area code is Texas — possibly out-of-state buyer.',
  },
  {
    name: 'Donald Tilley',
    locations: 'King, Pierce, Snohomish Co.',
    phones: ['(253) 778-0281'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. Dozens of no-answer call attempts from 1.2 through 2.3, including the "we\'ll take you off the list" text. No response at all.',
  },
  {
    name: 'Nehal Raval',
    locations: 'King, Pierce, Snohomish Co.',
    phones: ['(425) 457-3573'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. Dozens of no-answer call attempts from 1.2 through 2.3 including "we\'ll take you off the list" text on 1.26. No response.',
  },
  {
    name: 'Owen Fogarty',
    locations: 'King, Snohomish Co.',
    phones: ['(440) 227-1804'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. ~30 no-answer call attempts from 1.2 through 2.3. 440 area code is Cleveland, Ohio — possibly out-of-state. No response.',
  },
  {
    name: 'Paul Pangilinan',
    locations: 'King, Pierce, Snohomish Co.',
    phones: ['(425) 333-7308'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. Dozens of no-answer call attempts from 1.2 through 2.3 including the "we\'ll take you off the list" text 1.26. No response.',
  },
  {
    name: 'Ryker Young',
    locations: 'Pierce, King, Snohomish Co.',
    phones: ['(206) 930-0377'],
    emails: [],
    notes: 'NEVER REACHED. 2103 Kent sent 1.12 via text. Dozens of no-answer call attempts from 1.2 through 2.3 including the "we\'ll take you off the list" text 1.26. No response.',
  },
  {
    name: 'Yuriy Mulyarchuk',
    locations: null,
    phones: ['(206) 948-3885'],
    emails: [],
    notes: 'NEVER REACHED. Locations unknown — never confirmed a buy box. 2103 Kent sent 1.12 via text. Dozens of no-answer call attempts from 1.3 through 2.3 including the "we\'ll take you off the list" text 1.26. No response.',
  },
]

// "Not actively investing" batch — these prospects told us they\'re
// not currently in the market. March follow-up was scheduled and is
// now overdue. Setting status to 'inactive' so they don\'t clutter
// the main Investor Records view.
const INVESTORS = [
  {
    name: 'Aaron Knight',
    status: 'inactive',
    locations: null,
    phones: ['(206) 271-4673'],
    emails: [],
    notes: 'NOT ACTIVELY INVESTING (confirmed 1.19). 1.10 marked DNC (do not call). Locations never captured. March follow-up overdue — revisit if their situation changes.',
  },
  {
    name: 'Emily Yang',
    status: 'inactive',
    locations: 'King Co.',
    phones: ['(253) 234-5236'],
    emails: [],
    notes: 'NOT ACTIVELY INVESTING (confirmed on phone). 2103 Kent sent 12.28 — said not actively investing at the moment. March follow-up overdue.',
  },
  {
    name: 'Fernando',
    status: 'inactive',
    locations: 'Pierce, Snohomish Co.',
    phones: ['(516) 301-7656'],
    emails: ['sinkpar_92@hotmail.com'],
    notes: 'NOT ACTIVELY INVESTING (1.7) — currently has two projects in flight. Said perhaps in the future. March follow-up overdue. 516 area code is Long Island, NY — possibly out-of-state.',
  },
  {
    name: 'Kalin Edwards',
    status: 'inactive',
    locations: null,
    phones: ['(425) 760-3704'],
    emails: [],
    notes: 'NOT ACTIVELY INVESTING (1.2) — has a project he\'s working on, not interested currently. Perhaps in the future. Locations never captured. March follow-up overdue.',
  },
  {
    name: 'Triet',
    status: 'inactive',
    locations: null,
    phones: ['(425) 233-9298'],
    emails: [],
    notes: 'NOT ACTIVELY INVESTING (1.3). Locations never captured. March follow-up overdue.',
  },
  {
    name: 'Vihar Tammana',
    status: 'inactive',
    locations: 'King, Pierce, Snohomish (future)',
    phones: ['(425) 891-3446'],
    emails: ['vihartks@gmail.com'],
    notes: 'NOT ACTIVELY INVESTING right now (1.12) — but in the future would be interested in King and Pierce County. Asked for our company information. March follow-up overdue.',
  },
  {
    name: 'Zach Stickney',
    status: 'inactive',
    locations: 'Pierce Co.',
    phones: ['(360) 367-0820'],
    emails: [],
    notes: 'NOT ACTIVELY INVESTING (1.7). March follow-up overdue.',
  },
]

async function main() {
  // Resolve admin user for created_by
  const { data: admin, error: aErr } = await supabase.from('users').select('id').eq('email', ADMIN_EMAIL).single()
  if (aErr || !admin) {
    console.error('Admin user not found:', aErr?.message)
    process.exit(1)
  }
  const adminId = admin.id

  let ok = 0
  let fail = 0
  for (const inv of INVESTORS) {
    const displayName = inv.name.startsWith('💰') ? inv.name : `💰 ${inv.name}`
    try {
      // 1. investors row — status defaults to 'active' if not specified.
      const { data: row, error: iErr } = await supabase
        .from('investors')
        .insert({
          name: displayName,
          company: inv.company ?? null,
          locations_of_interest: inv.locations ?? null,
          deals_notes: inv.notes ?? null,
          status: inv.status ?? 'active',
          created_by: adminId,
        })
        .select()
        .single()
      if (iErr || !row) throw new Error(iErr?.message || 'Insert failed')

      // 2. investor_locations (split locations on , or ;)
      if (inv.locations) {
        const parts = inv.locations.split(/[;,]+/).map((s) => s.trim()).filter(Boolean)
        if (parts.length > 0) {
          const { error: lErr } = await supabase
            .from('investor_locations')
            .insert(parts.map((name) => ({ investor_id: row.id, location_name: name })))
          if (lErr) throw new Error('locations: ' + lErr.message)
        }
      }

      // 3. investor_phones (first = primary)
      if (inv.phones?.length) {
        const { error: pErr } = await supabase.from('investor_phones').insert(
          inv.phones.map((p, idx) => ({
            investor_id: row.id,
            phone_number: typeof p === 'string' ? p : p.phone_number,
            label: typeof p === 'string' ? '' : (p.label ?? ''),
            is_primary: idx === 0,
          })),
        )
        if (pErr) throw new Error('phones: ' + pErr.message)
      }

      // 4. investor_emails (first = primary)
      if (inv.emails?.length) {
        const { error: eErr } = await supabase.from('investor_emails').insert(
          inv.emails.map((e, idx) => ({
            investor_id: row.id,
            email: typeof e === 'string' ? e : e.email,
            label: typeof e === 'string' ? '' : (e.label ?? ''),
            is_primary: idx === 0,
          })),
        )
        if (eErr) throw new Error('emails: ' + eErr.message)
      }

      ok += 1
      console.log(`✓ ${displayName}  (id ${row.id})`)
    } catch (e) {
      fail += 1
      console.error(`✗ ${displayName} — ${e.message}`)
    }
  }

  console.log(`\nDone. ${ok} created, ${fail} failed.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
