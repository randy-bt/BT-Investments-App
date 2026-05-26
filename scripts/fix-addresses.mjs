// One-off: add the missing comma between street and city so streetOnly()
// in ListingPageV2 trims correctly. Two rows from a batch where the
// address was entered without the conventional comma separator.
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

const FIXES = [
  { slug: '615-wa',   newAddress: '615 SW 124th St, Seattle, WA' },
  { slug: '15620-wa', newAddress: '15620 12th Ave SW, Burien, WA' },
]

for (const fix of FIXES) {
  const { data, error } = await supabase
    .from('listing_pages')
    .select('id, inputs')
    .eq('slug', fix.slug)
    .single()
  if (error || !data) { console.error('not found:', fix.slug); continue }
  const newInputs = { ...data.inputs, address: fix.newAddress }
  const { error: uErr } = await supabase
    .from('listing_pages')
    .update({ address: fix.newAddress, inputs: newInputs })
    .eq('id', data.id)
  if (uErr) { console.error('update failed:', fix.slug, uErr.message); continue }
  console.log(`Updated ${fix.slug} -> "${fix.newAddress}"`)
}
