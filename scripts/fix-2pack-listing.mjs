// One-off: rewrite address + slug for the West Seattle 2-pack.
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

const OLD_SLUG = '9215-9215-20th-ave-sw'
const NEW_SLUG = '7305-and-9215-seattle-wa'
const NEW_ADDRESS = '7305 16th Ave SW & 9215 20th Ave SW, Seattle, WA'

const { data: row, error: rErr } = await supabase
  .from('listing_pages')
  .select('id, inputs, page_type')
  .eq('slug', OLD_SLUG)
  .single()
if (rErr || !row) { console.error('not found:', rErr?.message); process.exit(1) }

// Update both the row's address column AND inputs.address (the headline
// reads from inputs). Slug also gets replaced so the new URL is clean.
const newInputs = { ...row.inputs, address: NEW_ADDRESS }

const { error: uErr } = await supabase
  .from('listing_pages')
  .update({ slug: NEW_SLUG, address: NEW_ADDRESS, inputs: newInputs })
  .eq('id', row.id)

if (uErr) { console.error('update failed:', uErr.message); process.exit(1) }
console.log('Updated. New URL:')
console.log(`  /deals/${NEW_SLUG}  (page_type=${row.page_type})`)
